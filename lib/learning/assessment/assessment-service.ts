import { randomUUID } from "crypto";
import {
  AssessmentItem,
  AssessmentResponse,
  AssessmentScoreResult,
  AssessmentSession,
  AssessmentType,
  LearningGainReport,
  RetentionReport,
} from "./types";
import {
  getBlueprintsByDomainAndType,
  getBlueprintById,
} from "./curriculum/blueprints";
import {
  getIndependentAssessmentItems,
  getAssessmentItemById,
  validateItemIndependence,
  CURATED_INDEPENDENT_ASSESSMENT_ITEMS,
} from "./curriculum/items";
import { evaluateAssessmentItem, scoreAssessmentSession } from "./assessment-engine";
import { calculateLearningGain, calculateRetention } from "./measurement-engine";
import { supabasePersistence } from "@/lib/db/supabase-persistence";
import { logger } from "@/lib/observability/logger";
import { learningStateService } from "../state/learning-state-service";

export interface StartSessionParams {
  userId: string;
  learningGoalId: string;
  domainId: string;
  assessmentType: AssessmentType;
  blueprintId?: string;
  baselineItemIdsToAvoid?: string[];
}

export interface SubmitAnswerParams {
  userId: string;
  sessionId: string;
  itemId: string;
  answer: string;
  responseTimeMs?: number;
}

export class AssessmentService {
  // In-memory session store (mirrored to Supabase)
  private sessions = new Map<string, AssessmentSession>();
  private responses = new Map<string, AssessmentResponse[]>();
  private items = new Map<string, AssessmentItem>();
  private learningGains = new Map<string, LearningGainReport>(); // goalId -> report
  private retentionRecords = new Map<string, RetentionReport[]>(); // goalId -> reports

  constructor() {
    // Index curated items in memory
    for (const item of CURATED_INDEPENDENT_ASSESSMENT_ITEMS) {
      this.items.set(item.id, item);
    }
  }

  registerCustomItem(item: AssessmentItem): void {
    this.items.set(item.id, item);
  }

  /**
   * Starts an assessment session (§4, §16).
   * Enforces cross-user authorization, blueprint selection, and anti-leakage invariants.
   */
  async startAssessmentSession(params: StartSessionParams): Promise<{
    session: AssessmentSession;
    items: Omit<AssessmentItem, "correctAnswer" | "explanation">[];
  }> {
    const { userId, learningGoalId, domainId, assessmentType, baselineItemIdsToAvoid = [] } = params;

    // Verify goal exists and user owns it (§4)
    const goal = await learningStateService.getGoal(userId, learningGoalId);
    if (!goal || goal.userId !== userId) {
      throw new Error("Learning goal not found or unauthorized.");
    }

    // Resolve blueprint
    const blueprint =
      (params.blueprintId ? getBlueprintById(params.blueprintId) : undefined) ||
      getBlueprintsByDomainAndType(domainId, assessmentType);

    if (!blueprint) {
      throw new Error(`No assessment blueprint configured for domain '${domainId}' and type '${assessmentType}'.`);
    }

    // Candidate items from curated pool
    let candidateItems = getIndependentAssessmentItems(domainId, assessmentType);

    // Independence & Anti-leakage guard (§3)
    if (baselineItemIdsToAvoid.length > 0) {
      const check = validateItemIndependence(baselineItemIdsToAvoid, candidateItems);
      if (!check.isIndependent) {
        logger.warn("Item independence check detected collisions. Filtering candidate items.", {
          violations: check.violations,
        });
        candidateItems = candidateItems.filter((i) => !baselineItemIdsToAvoid.includes(i.id));
      }
    }

    // Limit to blueprint item count
    const selectedItems = candidateItems.slice(0, blueprint.itemCount);
    if (selectedItems.length === 0) {
      throw new Error(`No independent assessment items available for domain '${domainId}' and form '${assessmentType}'.`);
    }

    const sessionId = randomUUID();
    const session: AssessmentSession = {
      id: sessionId,
      userId,
      learningGoalId,
      domainId,
      blueprintId: blueprint.id,
      assessmentType,
      formVersion: blueprint.version,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      itemIds: selectedItems.map((i) => i.id),
      metadata: {
        itemCount: selectedItems.length,
        blueprintVersion: blueprint.version,
      },
    };

    this.sessions.set(sessionId, session);
    this.responses.set(sessionId, []);

    // Persist to Supabase
    await supabasePersistence.persistIndependentAssessmentSession(session);

    // Obfuscate answer and explanation before sending to client
    const safeItems = selectedItems.map((item) => {
      const { correctAnswer, explanation, ...rest } = item;
      void correctAnswer;
      void explanation;
      return rest;
    });

    logger.info("Assessment session started", {
      sessionId,
      userId,
      goalId: learningGoalId,
      assessmentType,
      itemCount: selectedItems.length,
    });

    return { session, items: safeItems };
  }

  /**
   * Submits an answer for an assessment item (§2, §4).
   */
  async submitAnswer(params: SubmitAnswerParams): Promise<{
    response: AssessmentResponse;
    completedItems: number;
    totalItems: number;
  }> {
    const { userId, sessionId, itemId, answer, responseTimeMs } = params;

    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Assessment session not found or unauthorized.");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new Error(`Cannot submit answer to assessment in state: ${session.status}`);
    }

    const item = this.items.get(itemId) || getAssessmentItemById(itemId);
    if (!item) {
      throw new Error(`Assessment item not found: ${itemId}`);
    }

    const evalResult = evaluateAssessmentItem(item, answer);

    const response: AssessmentResponse = {
      id: randomUUID(),
      sessionId,
      userId,
      itemId,
      competencyId: item.competencyId,
      answer,
      isCorrect: evalResult.isCorrect,
      score: evalResult.score,
      responseTimeMs,
      submittedAt: new Date().toISOString(),
    };

    const sessionResponses = this.responses.get(sessionId) || [];
    // Replace if item already answered, else append
    const existingIdx = sessionResponses.findIndex((r) => r.itemId === itemId);
    if (existingIdx >= 0) {
      sessionResponses[existingIdx] = response;
    } else {
      sessionResponses.push(response);
    }
    this.responses.set(sessionId, sessionResponses);

    // Persist to Supabase
    await supabasePersistence.persistIndependentAssessmentResponse(response);

    return {
      response,
      completedItems: sessionResponses.length,
      totalItems: session.itemIds.length,
    };
  }

  /**
   * Completes and deterministically scores an assessment session (§5, §7, §8, §9).
   */
  async completeAssessment(
    userId: string,
    sessionId: string
  ): Promise<{
    session: AssessmentSession;
    scoreResult: AssessmentScoreResult;
    learningGainReport?: LearningGainReport;
    retentionReport?: RetentionReport;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Assessment session not found or unauthorized.");
    }

    if (session.status === "COMPLETED") {
      throw new Error("Assessment session is already COMPLETED.");
    }

    const sessionResponses = this.responses.get(sessionId) || [];
    const sessionItems = session.itemIds
      .map((id) => this.items.get(id) || getAssessmentItemById(id))
      .filter((i): i is AssessmentItem => Boolean(i));

    // Calculate deterministic scores
    const scoreResult = scoreAssessmentSession(sessionItems, sessionResponses);

    const completedAt = new Date().toISOString();
    session.status = "COMPLETED";
    session.overallScore = scoreResult.overallScore;
    session.completedAt = completedAt;

    this.sessions.set(sessionId, session);
    await supabasePersistence.persistIndependentAssessmentSession(session);

    // Retrieve baseline from existing LearningStateService (§9)
    const currentState = await learningStateService.getCurrentLearningState(userId, session.learningGoalId);
    const baselineScore = currentState.overallBaselineScore ?? 50.0;
    const baselineCompScores: Record<string, number> = {};
    for (const comp of currentState.competencies) {
      baselineCompScores[comp.competencyId] = comp.baselineScore;
    }

    const currentCompScores: Record<string, number> = {};
    for (const [compId, stats] of Object.entries(scoreResult.competencyScores)) {
      currentCompScores[compId] = stats.score;
    }

    // Emit evidence through existing learning state (§14)
    for (const [compId, stats] of Object.entries(scoreResult.competencyScores)) {
      await supabasePersistence.persistEvidence({
        userId,
        learningGoalId: session.learningGoalId,
        competencyId: compId,
        evidenceType: session.assessmentType === "FINAL" ? "FINAL_ASSESSMENT" : session.assessmentType,
        result: stats.score >= 70 ? "SUCCESS" : "FAILURE",
        score: stats.score,
        confidence: 0.85,
        source: `assessment:${session.assessmentType.toLowerCase()}:${sessionId}`,
        mapVersion: "1.0.0",
        metadata: {
          sessionId,
          assessmentType: session.assessmentType,
          totalItems: stats.totalItems,
          correctItems: stats.correctItems,
        },
      });
    }

    let learningGainReport: LearningGainReport | undefined;
    let retentionReport: RetentionReport | undefined;

    // Handle FINAL assessment: calculate learning gain (§7)
    if (session.assessmentType === "FINAL") {
      learningGainReport = calculateLearningGain({
        learningGoalId: session.learningGoalId,
        userId,
        domainId: session.domainId,
        baselineSessionId: `baseline-${session.learningGoalId}`,
        baselineScore,
        finalSessionId: session.id,
        finalScore: scoreResult.overallScore,
        baselineCompetencyScores: baselineCompScores,
        finalCompetencyScores: currentCompScores,
      });

      this.learningGains.set(session.learningGoalId, learningGainReport);
      await supabasePersistence.persistLearningGain(learningGainReport);

      logger.info("Learning Gain Calculated", {
        goalId: session.learningGoalId,
        baselineScore,
        finalScore: scoreResult.overallScore,
        learningGain: learningGainReport.learningGain,
      });
    }

    // Handle RETENTION assessment (D7 or D30) (§8)
    if (session.assessmentType === "RETENTION_D7" || session.assessmentType === "RETENTION_D30") {
      const priorGain = this.learningGains.get(session.learningGoalId);
      const finalScore = priorGain?.finalScore ?? 75.0;
      const finalSessionId = priorGain?.finalSessionId || "prior-final-session";

      const retType = session.assessmentType === "RETENTION_D7" ? "D7" : "D30";
      const daysSince = retType === "D7" ? 7 : 30;

      retentionReport = calculateRetention({
        learningGoalId: session.learningGoalId,
        userId,
        domainId: session.domainId,
        retentionType: retType,
        baselineScore,
        finalSessionId,
        finalScore,
        retentionSessionId: session.id,
        retentionScore: scoreResult.overallScore,
        daysSinceFinal: daysSince,
        finalCompetencyScores: priorGain
          ? Object.fromEntries(priorGain.competencyGains.map((cg) => [cg.competencyId, cg.finalScore]))
          : currentCompScores,
        retentionCompetencyScores: currentCompScores,
      });

      const existingRecords = this.retentionRecords.get(session.learningGoalId) || [];
      existingRecords.push(retentionReport);
      this.retentionRecords.set(session.learningGoalId, existingRecords);

      await supabasePersistence.persistRetentionRecord(retentionReport);

      logger.info("Retention Record Calculated", {
        goalId: session.learningGoalId,
        retentionType: retType,
        finalScore,
        retentionScore: scoreResult.overallScore,
        retentionRatio: retentionReport.retentionRatio,
      });
    }

    return {
      session,
      scoreResult,
      learningGainReport,
      retentionReport,
    };
  }

  /**
   * Retrieves goal measurement and learning gain state (§10, §15).
   */
  async getMeasurementReport(
    userId: string,
    goalId: string
  ): Promise<{
    learningGoalId: string;
    baseline: { score: number; establishedAt?: string };
    final: { score: number; completedAt?: string } | null;
    learningGain: number | null;
    relativeGain: number | null;
    competencyGains: LearningGainReport["competencyGains"];
    retention: {
      d7: RetentionReport | null;
      d30: RetentionReport | null;
    };
  }> {
    const goal = await learningStateService.getGoal(userId, goalId);
    if (!goal || goal.userId !== userId) {
      throw new Error("Learning goal not found or unauthorized.");
    }

    const currentState = await learningStateService.getCurrentLearningState(userId, goalId);
    const baselineScore = currentState.overallBaselineScore ?? 0;

    const gainReport = this.learningGains.get(goalId);
    const retentionList = this.retentionRecords.get(goalId) || [];
    const d7Report = retentionList.find((r) => r.retentionType === "D7") || null;
    const d30Report = retentionList.find((r) => r.retentionType === "D30") || null;

    return {
      learningGoalId: goalId,
      baseline: {
        score: baselineScore,
        establishedAt: currentState.diagnosticCompleted ? "established" : undefined,
      },
      final: gainReport
        ? {
            score: gainReport.finalScore,
            completedAt: gainReport.calculatedAt,
          }
        : null,
      learningGain: gainReport ? gainReport.learningGain : null,
      relativeGain: gainReport ? gainReport.relativeGain : null,
      competencyGains: gainReport ? gainReport.competencyGains : [],
      retention: {
        d7: d7Report,
        d30: d30Report,
      },
    };
  }

  getSession(sessionId: string): AssessmentSession | undefined {
    return this.sessions.get(sessionId);
  }
}

const globalForAssessment = globalThis as unknown as {
  assessmentService?: AssessmentService;
};

export const assessmentService =
  globalForAssessment.assessmentService || new AssessmentService();

if (process.env.NODE_ENV !== "production") {
  globalForAssessment.assessmentService = assessmentService;
}
