import { randomUUID as uuidv4 } from "crypto";
import { learningStateService, UnauthorizedAccessError } from "./learning-state-service";
import { masteryService } from "./mastery-service";
import {
  getScheduler,
  ReviewRating,
  SchedulerState,
  SchedulerType,
  SchedulingResult,
} from "../spaced-repetition/scheduler";
import { MasteryCalculationOutput } from "../mastery";
import { supabasePersistence } from "@/lib/db/supabase-persistence";

export interface ReviewItemEntity {
  id: string;
  userId: string;
  learningGoalId: string;
  competencyId: string;
  schedulerType: SchedulerType;
  schedulerVersion: string;
  schedulerState: SchedulerState;
  dueAt: string;
  lastReviewedAt?: string;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSessionEntity {
  id: string;
  userId: string;
  learningGoalId: string;
  itemCount: number;
  completedCount: number;
  score?: number;
  status: "PENDING" | "STARTED" | "COMPLETED" | "ABANDONED";
  itemIds: string[];
  startedAt: string;
  completedAt?: string;
}

export const DEFAULT_REVIEW_SESSION_SIZE = 10;

/**
 * ReviewService (§11–19, §30)
 * Manages spaced repetition review items, due queue discovery,
 * session orchestration, idempotency guards, and learning evidence integration.
 */
export class ReviewService {
  private reviewItems: Map<string, ReviewItemEntity> = new Map();
  private reviewSessions: Map<string, ReviewSessionEntity> = new Map();

  /**
   * Registers or retrieves a review item for a competency (§13)
   */
  async ensureReviewItem(
    userId: string,
    goalId: string,
    competencyId: string,
    schedulerType: SchedulerType = "FSRS",
    referenceDate: Date = new Date()
  ): Promise<ReviewItemEntity> {
    await learningStateService.getGoal(userId, goalId);

    const existing = Array.from(this.reviewItems.values()).find(
      (item) =>
        item.userId === userId &&
        item.learningGoalId === goalId &&
        item.competencyId === competencyId
    );

    if (existing) {
      return existing;
    }

    const scheduler = getScheduler(schedulerType);
    const initialState = scheduler.initItem(referenceDate);
    const now = referenceDate.toISOString();

    const item: ReviewItemEntity = {
      id: uuidv4(),
      userId,
      learningGoalId: goalId,
      competencyId,
      schedulerType,
      schedulerVersion: scheduler.schedulerVersion,
      schedulerState: initialState,
      dueAt: initialState.dueDate,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.reviewItems.set(item.id, item);
    await supabasePersistence.persistReviewItem(item as unknown as {
      id: string;
      userId: string;
      learningGoalId: string;
      competencyId: string;
      schedulerType: string;
      schedulerVersion: string;
      schedulerState: Record<string, unknown>;
      dueAt: string;
      lastReviewedAt?: string;
      reviewCount: number;
      createdAt: string;
      updatedAt: string;
    });
    return item;
  }

  /**
   * Discovers due review items prioritizing overdue duration and lowest retrievability (§16, §19)
   */
  async getReviewQueue(
    userId: string,
    goalId: string,
    limit: number = DEFAULT_REVIEW_SESSION_SIZE,
    referenceDate: Date = new Date()
  ): Promise<ReviewItemEntity[]> {
    await learningStateService.getGoal(userId, goalId);

    const userItems = Array.from(this.reviewItems.values()).filter(
      (item) => item.userId === userId && item.learningGoalId === goalId
    );

    const dueItems: Array<{ item: ReviewItemEntity; overdueMs: number; retrievability: number }> = [];

    for (const item of userItems) {
      const scheduler = getScheduler(item.schedulerType);
      if (scheduler.isDue(item.schedulerState, referenceDate)) {
        const dueTime = new Date(item.dueAt).getTime();
        const overdueMs = Math.max(0, referenceDate.getTime() - dueTime);
        const retrievability = scheduler.getRetrievability(item.schedulerState, referenceDate);

        dueItems.push({
          item,
          overdueMs,
          retrievability,
        });
      }
    }

    // Sort order:
    // 1. Overdue duration descending (most overdue first)
    // 2. Retrievability ascending (hardest to retrieve first)
    dueItems.sort((a, b) => {
      if (b.overdueMs !== a.overdueMs) {
        return b.overdueMs - a.overdueMs;
      }
      return a.retrievability - b.retrievability;
    });

    return dueItems.slice(0, limit).map((d) => d.item);
  }

  /**
   * Submits an answer for a review item, advances scheduler state,
   * generates append-only REVIEW evidence, and recalculates mastery (§14, §17, §30).
   */
  async answerReviewItem(
    userId: string,
    reviewItemId: string,
    rating: ReviewRating,
    score: number,
    referenceDate: Date = new Date()
  ): Promise<{
    reviewItem: ReviewItemEntity;
    schedulingResult: SchedulingResult;
    masteryOutput: MasteryCalculationOutput;
  }> {
    const item = this.reviewItems.get(reviewItemId);
    if (!item) {
      throw new Error(`Review item '${reviewItemId}' not found.`);
    }
    if (item.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot answer review item belonging to another user.");
    }

    // Idempotency Guard (§30): Prevent duplicate advancement within 3 seconds
    if (item.lastReviewedAt) {
      const lastReviewTime = new Date(item.lastReviewedAt).getTime();
      const diffMs = referenceDate.getTime() - lastReviewTime;
      if (diffMs >= 0 && diffMs < 3000) {
        const scheduler = getScheduler(item.schedulerType);
        return {
          reviewItem: item,
          schedulingResult: {
            nextState: item.schedulerState,
            intervalDays: item.lastReviewedAt
              ? Math.max(1, Math.round((new Date(item.dueAt).getTime() - new Date(item.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24)))
              : 1,
            dueDate: item.dueAt,
            retrievability: scheduler.getRetrievability(item.schedulerState, referenceDate),
          },
          masteryOutput: (await masteryService.recalculateCompetencyMastery(
            userId,
            item.learningGoalId,
            item.competencyId,
            "REVIEW_IDEMPOTENT_REPLAY"
          )).masteryOutput,
        };
      }
    }

    const scheduler = getScheduler(item.schedulerType);
    const schedulingResult = scheduler.review(item.schedulerState, rating, referenceDate);
    const now = referenceDate.toISOString();

    // Advance scheduler state
    item.schedulerState = schedulingResult.nextState;
    item.dueAt = schedulingResult.dueDate;
    item.lastReviewedAt = now;
    item.reviewCount += 1;
    item.updatedAt = now;

    await supabasePersistence.persistReviewItem(item as unknown as {
      id: string;
      userId: string;
      learningGoalId: string;
      competencyId: string;
      schedulerType: string;
      schedulerVersion: string;
      schedulerState: Record<string, unknown>;
      dueAt: string;
      lastReviewedAt?: string;
      reviewCount: number;
      createdAt: string;
      updatedAt: string;
    });

    // Record Append-Only REVIEW Evidence (§14)
    await learningStateService.recordReviewEvidence(
      userId,
      item.learningGoalId,
      item.competencyId,
      score,
      0.8,
      {
        reviewItemId: item.id,
        rating,
        schedulerType: item.schedulerType,
        intervalDays: schedulingResult.intervalDays,
        retrievability: schedulingResult.retrievability,
      }
    );

    // Recalculate Mastery through Learning Engine (§12)
    const { masteryOutput } = await masteryService.recalculateCompetencyMastery(
      userId,
      item.learningGoalId,
      item.competencyId,
      "REVIEW_COMPLETED"
    );

    return {
      reviewItem: item,
      schedulingResult,
      masteryOutput,
    };
  }

  /**
   * Starts a Review Session (§15)
   */
  async startReviewSession(
    userId: string,
    goalId: string,
    limit: number = DEFAULT_REVIEW_SESSION_SIZE,
    referenceDate: Date = new Date()
  ): Promise<ReviewSessionEntity> {
    const queue = await this.getReviewQueue(userId, goalId, limit, referenceDate);

    const session: ReviewSessionEntity = {
      id: uuidv4(),
      userId,
      learningGoalId: goalId,
      itemCount: queue.length,
      completedCount: 0,
      status: "STARTED",
      itemIds: queue.map((q) => q.id),
      startedAt: referenceDate.toISOString(),
    };

    this.reviewSessions.set(session.id, session);
    await supabasePersistence.persistReviewSession(session);
    return session;
  }

  /**
   * Submits an answer inside a Review Session (§15, §17)
   */
  async submitSessionAnswer(
    userId: string,
    sessionId: string,
    reviewItemId: string,
    rating: ReviewRating,
    score: number,
    referenceDate: Date = new Date()
  ): Promise<{
    session: ReviewSessionEntity;
    result: {
      reviewItem: ReviewItemEntity;
      schedulingResult: SchedulingResult;
      masteryOutput: MasteryCalculationOutput;
    };
  }> {
    const session = this.reviewSessions.get(sessionId);
    if (!session) {
      throw new Error(`Review session '${sessionId}' not found.`);
    }
    if (session.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot modify another user's review session.");
    }

    const answerResult = await this.answerReviewItem(
      userId,
      reviewItemId,
      rating,
      score,
      referenceDate
    );

    session.completedCount += 1;
    if (session.completedCount >= session.itemCount) {
      session.status = "COMPLETED";
      session.completedAt = referenceDate.toISOString();
    }

    await supabasePersistence.persistReviewSession(session);

    return {
      session,
      result: answerResult,
    };
  }

  async getReviewItem(userId: string, reviewItemId: string): Promise<ReviewItemEntity> {
    const item = this.reviewItems.get(reviewItemId);
    if (!item) {
      throw new Error(`Review item '${reviewItemId}' not found.`);
    }
    if (item.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot access review item belonging to another user.");
    }
    return item;
  }

  async getAllReviewItems(userId: string, goalId: string): Promise<ReviewItemEntity[]> {
    await learningStateService.getGoal(userId, goalId);
    return Array.from(this.reviewItems.values()).filter(
      (item) => item.userId === userId && item.learningGoalId === goalId
    );
  }
}

export const reviewService = new ReviewService();
