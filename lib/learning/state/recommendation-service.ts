import { randomUUID as uuidv4 } from "crypto";
import { learningStateService, UnauthorizedAccessError } from "./learning-state-service";
import { masteryService } from "./mastery-service";
import { competencyMapService } from "../competency-map";
import { getCuratedCompetenciesByDomain } from "../curriculum";
import {
  RecommendationEntity,
} from "../types";

import {
  LearnerCompetencyState,
  LearnerObjectiveContext,
  RecommendationContext,
  RECOMMENDATION_ALGORITHM_VERSION,
} from "../recommendations";
import { calculateNextBestAction } from "../next-best-action";
import { generateAdaptiveLearningPlan, AdaptiveLearningPlan } from "../learning-plan";
import { LearningGap } from "../gap-analysis";

/**
 * RecommendationService (§13, §27–33, §49, §56, §57)
 * Orchestrates recommendation generation, lifecycle progression,
 * stale recommendation invalidation, and dynamic adaptive plan reconstruction.
 */
export class RecommendationService {
  // In-memory store mirroring public.recommendations table
  private recommendations: Map<string, RecommendationEntity> = new Map();

  /**
   * Evaluates and returns the Next Best Action for the learner (§33)
   * Invalidates stale active recommendations when learner state changes (§56, §63).
   */
  async getNextBestAction(
    userId: string,
    goalId: string,
    referenceDate: Date = new Date()
  ): Promise<RecommendationEntity> {
    // 1. Verify user ownership of the goal (§49)
    const goal = await learningStateService.getGoal(userId, goalId);

    // 2. Fetch domain graph & curated competencies
    const graph = competencyMapService.getGraph(goal.domainId);
    if (!graph) {
      throw new Error(`Prerequisite graph not found for domain '${goal.domainId}'.`);
    }
    const allCompetencies = getCuratedCompetenciesByDomain(goal.domainId);

    // 3. Assemble current competency states & evidence summary
    const currentStateView = await learningStateService.getCurrentLearningState(userId, goalId);
    const allEvidence = await learningStateService.getAllEvidence(userId, goalId);

    const statesMap = new Map<string, LearnerCompetencyState>();
    for (const comp of currentStateView.competencies) {
      const compEvidence = allEvidence.filter((e) => e.competencyId === comp.competencyId);
      const lastEv = compEvidence.length > 0 ? compEvidence[compEvidence.length - 1] : undefined;

      statesMap.set(comp.competencyId, {
        competencyId: comp.competencyId,
        masteryScore: comp.masteryScore,
        confidenceScore: comp.confidenceScore,
        evidenceCount: comp.evidenceCount,
        lastEvidenceAt: comp.lastEvidenceAt,
        lastEvidenceResult: lastEv?.result,
        lastEvidenceScore: lastEv?.score,
        lastEvidenceType: lastEv?.evidenceType,
      });
    }

    // 4. Fetch active gaps
    const gapList = await masteryService.getGaps(userId, goalId);
    const gapsMap = new Map<string, LearningGap>();
    for (const g of gapList) {
      gapsMap.set(g.competencyId, g);
    }

    // 5. Parse objective details
    let parsedObjective: { scope?: string[]; level?: string; deadline?: string } = {};
    try {
      parsedObjective = JSON.parse(goal.normalizedObjective);
    } catch {
      // Use defaults if parse fails
    }

    const objectiveContext: LearnerObjectiveContext = {
      domainId: goal.domainId,
      targetOutcome: goal.targetOutcome,
      scope: parsedObjective.scope,
      level: parsedObjective.level,
      deadline: parsedObjective.deadline,
    };

    // 6. Build recommendation context
    const context: RecommendationContext = {
      userId,
      learningGoalId: goalId,
      objective: objectiveContext,
      competencyStates: statesMap,
      gaps: gapsMap,
      prerequisiteGraph: graph,
      allCompetencies,
      referenceDate,
    };

    // 7. Calculate fresh Next Best Action using pure engine (§59)
    const decision = calculateNextBestAction(context);
    const freshCandidate = decision.recommendation;

    // 8. Stale Recommendation Handling (§56, §57, §63)
    // Find active recommendations (PENDING or PRESENTED) for this user & goal
    const activeRec = Array.from(this.recommendations.values()).find(
      (r) =>
        r.userId === userId &&
        r.learningGoalId === goalId &&
        (r.status === "PENDING" || r.status === "PRESENTED")
    );

    if (activeRec) {
      const isStillValid =
        activeRec.competencyId === freshCandidate.competencyId &&
        activeRec.action === freshCandidate.action;

      if (isStillValid) {
        return activeRec;
      } else {
        // Mark stale recommendation as EXPIRED (§56)
        activeRec.status = "EXPIRED";
      }
    }

    // 9. Persist and return new recommendation entity
    const now = referenceDate.toISOString();
    const newRecommendation: RecommendationEntity = {
      id: uuidv4(),
      userId,
      learningGoalId: goalId,
      competencyId: freshCandidate.competencyId,
      action: freshCandidate.action,
      priority: freshCandidate.priority,
      reason: freshCandidate.reason,
      estimatedMinutes: freshCandidate.estimatedMinutes,
      status: "PENDING",
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      generatedAt: now,
    };

    this.recommendations.set(newRecommendation.id, newRecommendation);
    return newRecommendation;
  }

  /**
   * Transition recommendation: PENDING -> PRESENTED (§27, §32)
   */
  async presentRecommendation(userId: string, recommendationId: string): Promise<RecommendationEntity> {
    const rec = this.recommendations.get(recommendationId);
    if (!rec) {
      throw new Error(`Recommendation '${recommendationId}' not found.`);
    }
    if (rec.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot access recommendation belonging to another user.");
    }

    if (rec.status === "PENDING") {
      rec.status = "PRESENTED";
      rec.presentedAt = new Date().toISOString();
    }

    return rec;
  }

  /**
   * Transition recommendation: PRESENTED/PENDING -> ACCEPTED (§27, §28, §32)
   * CRITICAL (§28): Acceptance records choice, NEVER creates learning evidence!
   */
  async acceptRecommendation(userId: string, recommendationId: string): Promise<RecommendationEntity> {
    const rec = this.recommendations.get(recommendationId);
    if (!rec) {
      throw new Error(`Recommendation '${recommendationId}' not found.`);
    }
    if (rec.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot accept recommendation belonging to another user.");
    }

    if (rec.status === "PENDING" || rec.status === "PRESENTED") {
      rec.status = "ACCEPTED";
      rec.acceptedAt = new Date().toISOString();
    }

    return rec;
  }

  /**
   * Transition recommendation: -> SKIPPED (§27, §32)
   */
  async skipRecommendation(userId: string, recommendationId: string): Promise<RecommendationEntity> {
    const rec = this.recommendations.get(recommendationId);
    if (!rec) {
      throw new Error(`Recommendation '${recommendationId}' not found.`);
    }
    if (rec.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot skip recommendation belonging to another user.");
    }

    rec.status = "SKIPPED";
    rec.skippedAt = new Date().toISOString();

    return rec;
  }

  /**
   * Transition recommendation: ACCEPTED -> COMPLETED (§27, §29, §32)
   * CRITICAL (§29): Completion marks recommendation record, does NOT fabricate learning evidence.
   */
  async completeRecommendation(userId: string, recommendationId: string): Promise<RecommendationEntity> {
    const rec = this.recommendations.get(recommendationId);
    if (!rec) {
      throw new Error(`Recommendation '${recommendationId}' not found.`);
    }
    if (rec.userId !== userId) {
      throw new UnauthorizedAccessError("Cannot complete recommendation belonging to another user.");
    }

    rec.status = "COMPLETED";
    rec.completedAt = new Date().toISOString();

    return rec;
  }

  /**
   * Dynamically reconstructs the Adaptive Learning Plan on demand (§24, §26, §55)
   */
  async getAdaptiveLearningPlan(
    userId: string,
    goalId: string,
    referenceDate: Date = new Date()
  ): Promise<AdaptiveLearningPlan> {
    const goal = await learningStateService.getGoal(userId, goalId);

    const graph = competencyMapService.getGraph(goal.domainId);
    if (!graph) {
      throw new Error(`Prerequisite graph not found for domain '${goal.domainId}'.`);
    }
    const allCompetencies = getCuratedCompetenciesByDomain(goal.domainId);

    const currentStateView = await learningStateService.getCurrentLearningState(userId, goalId);
    const allEvidence = await learningStateService.getAllEvidence(userId, goalId);

    const statesMap = new Map<string, LearnerCompetencyState>();
    for (const comp of currentStateView.competencies) {
      const compEvidence = allEvidence.filter((e) => e.competencyId === comp.competencyId);
      const lastEv = compEvidence.length > 0 ? compEvidence[compEvidence.length - 1] : undefined;

      statesMap.set(comp.competencyId, {
        competencyId: comp.competencyId,
        masteryScore: comp.masteryScore,
        confidenceScore: comp.confidenceScore,
        evidenceCount: comp.evidenceCount,
        lastEvidenceAt: comp.lastEvidenceAt,
        lastEvidenceResult: lastEv?.result,
        lastEvidenceScore: lastEv?.score,
        lastEvidenceType: lastEv?.evidenceType,
      });
    }

    const gapList = await masteryService.getGaps(userId, goalId);
    const gapsMap = new Map<string, LearningGap>();
    for (const g of gapList) {
      gapsMap.set(g.competencyId, g);
    }

    let parsedObjective: { scope?: string[]; level?: string; deadline?: string } = {};
    try {
      parsedObjective = JSON.parse(goal.normalizedObjective);
    } catch {
      // Use defaults
    }

    const context: RecommendationContext = {
      userId,
      learningGoalId: goalId,
      objective: {
        domainId: goal.domainId,
        targetOutcome: goal.targetOutcome,
        scope: parsedObjective.scope,
        level: parsedObjective.level,
        deadline: parsedObjective.deadline,
      },
      competencyStates: statesMap,
      gaps: gapsMap,
      prerequisiteGraph: graph,
      allCompetencies,
      referenceDate,
    };

    return generateAdaptiveLearningPlan(context);
  }

  /**
   * Retrieves recommendation history for auditing and analytics (§30, §53)
   */
  async getRecommendationHistory(userId: string, goalId?: string): Promise<RecommendationEntity[]> {
    if (goalId) {
      await learningStateService.getGoal(userId, goalId);
    }

    return Array.from(this.recommendations.values()).filter(
      (r) => r.userId === userId && (!goalId || r.learningGoalId === goalId)
    );
  }
}

export const recommendationService = new RecommendationService();
