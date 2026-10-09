import { randomUUID as uuidv4 } from "crypto";
import { getDomain } from "../domains";
import { normalizeObjective, NormalizeObjectiveInput } from "../objective-normalizer";
import { getDiagnosticItemsByDomain, getDiagnosticItemById } from "../diagnostic/curriculum";
import {
  DiagnosticItem,
  DiagnosticSession,
  DiagnosticResponse,
  DiagnosticCompletionReport,
} from "../diagnostic/types";
import { evaluateDiagnosticItem, aggregateDiagnosticReport } from "../diagnostic/evaluator";
import { EvidenceRecord, getMasteryState, MasteryState } from "../types";
import { supabasePersistence, isLiveDatabaseConfigured } from "@/lib/db/supabase-persistence";
import { createAdminClient } from "@/lib/db/supabase-admin";

export class UnauthorizedAccessError extends Error {
  constructor(message = "Unauthorized: Access denied to requested learner resource.") {
    super(message);
    this.name = "UnauthorizedAccessError";
  }
}

export interface LearningGoalEntity {
  id: string;
  userId: string;
  domainId: string;
  title: string;
  normalizedObjective: string;
  targetOutcome: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
}

export interface LearningProfileEntity {
  id: string;
  userId: string;
  activeGoalId: string;
  domainId: string;
  mapVersionId: string;
  selfReportedLevel?: string;
  targetOutcome?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyStateEntity {
  id: string;
  userId: string;
  learningGoalId: string;
  competencyId: string;
  baselineScore: number;
  currentScore: number;
  masteryState: MasteryState;
  confidenceScore: number;
  evidenceCount: number;
  lastEvidenceAt: string;
  updatedAt: string;
}

export interface CurrentLearningStateView {
  userId: string;
  goalId: string;
  domainId: string;
  mapVersion: string;
  overallBaselineScore: number;
  diagnosticCompleted: boolean;
  competencies: Array<{
    competencyId: string;
    baselineScore: number;
    masteryScore: number;
    masteryState: MasteryState;
    confidence: number;
    confidenceScore: number;
    evidenceCount: number;
    lastEvidenceAt: string;
  }>;
}

/**
 * LearningStateService (§13, §18, §19, §26, §36)
 * Core learner state repository with strict user ownership validation,
 * append-only evidence recording, and baseline score preservation.
 */
export class LearningStateService {
  // In-memory persistent stores (parity with database schema)
  private goals: Map<string, LearningGoalEntity> = new Map();
  private profiles: Map<string, LearningProfileEntity> = new Map();
  private sessions: Map<string, DiagnosticSession> = new Map();
  private responses: Map<string, DiagnosticResponse[]> = new Map(); // sessionId -> responses
  private competencyStates: Map<string, CompetencyStateEntity> = new Map(); // `${userId}:${goalId}:${competencyId}`
  private evidenceRecords: EvidenceRecord[] = [];

  /**
   * Creates a learning goal and normalizes its objective (§4, §5)
   */
  async createGoal(
    userId: string,
    input: NormalizeObjectiveInput
  ): Promise<{ goal: LearningGoalEntity; profile: LearningProfileEntity }> {
    const domain = getDomain(input.selectedDomainId);
    if (!domain) {
      throw new Error(`Invalid domain '${input.selectedDomainId}'.`);
    }

    const normResult = await normalizeObjective(input);
    const goalId = uuidv4();
    const now = new Date().toISOString();

    const goal: LearningGoalEntity = {
      id: goalId,
      userId,
      domainId: input.selectedDomainId,
      title: normResult.normalized.targetOutcome || `Learn ${domain.name}`,
      normalizedObjective: JSON.stringify(normResult.normalized),
      targetOutcome: normResult.normalized.targetOutcome,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now,
    };

    this.goals.set(goalId, goal);

    // Create or update profile (§17)
    const profileId = uuidv4();
    const profile: LearningProfileEntity = {
      id: profileId,
      userId,
      activeGoalId: goalId,
      domainId: input.selectedDomainId,
      mapVersionId: domain.version, // Map version freeze anchor (§25)
      selfReportedLevel: input.selfReportedLevel,
      targetOutcome: normResult.normalized.targetOutcome,
      createdAt: now,
      updatedAt: now,
    };

    this.goals.set(goalId, goal);
    this.profiles.set(userId, profile);

    await supabasePersistence.persistGoal(goal);
    await supabasePersistence.persistProfile(profile);

    return { goal, profile };
  }

  /**
   * Retrieves a goal ensuring strict user ownership (§36)
   */
  async getGoal(userId: string, goalId: string): Promise<LearningGoalEntity> {
    let goal = this.goals.get(goalId);
    if (!goal && isLiveDatabaseConfigured()) {
      try {
        const client = createAdminClient();
        const { data, error } = await client
          .from("learning_goals")
          .select("*")
          .eq("id", goalId)
          .maybeSingle();

        if (data && !error) {
          goal = {
            id: data.id,
            userId: data.user_id,
            domainId: data.domain_id,
            title: data.raw_objective || data.target_outcome || "Goal",
            normalizedObjective: typeof data.normalized_objective === "string" ? data.normalized_objective : JSON.stringify(data.normalized_objective),
            targetOutcome: data.target_outcome,
            status: data.status,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          this.goals.set(goal.id, goal);
        }
      } catch {
        // Fallback to in-memory check
      }
    }
    if (!goal) {
      throw new Error(`Goal with ID '${goalId}' not found.`);
    }
    if (goal.userId !== userId) {
      throw new UnauthorizedAccessError("Access denied: You do not own this learning goal.");
    }
    return goal;
  }

  /**
   * Starts a diagnostic session for a goal (§13, §25)
   */
  async startDiagnostic(
    userId: string,
    goalId: string
  ): Promise<{ session: DiagnosticSession; items: DiagnosticItem[] }> {
    const goal = await this.getGoal(userId, goalId);

    const domain = getDomain(goal.domainId);
    if (!domain) {
      throw new Error(`Domain '${goal.domainId}' is invalid.`);
    }

    const items = getDiagnosticItemsByDomain(goal.domainId);
    if (items.length === 0) {
      throw new Error(`No diagnostic items seeded for domain '${goal.domainId}'.`);
    }

    const sessionId = uuidv4();
    const session: DiagnosticSession = {
      id: sessionId,
      userId,
      learningGoalId: goalId,
      domainId: goal.domainId,
      mapVersion: domain.version, // Map version freeze (§25)
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      itemIds: items.map((i) => i.id),
    };

    this.sessions.set(sessionId, session);
    this.responses.set(sessionId, []);
    await supabasePersistence.persistDiagnosticSession(session);

    return { session, items };
  }

  /**
   * Submits an answer to a diagnostic item (§14)
   */
  async submitDiagnosticAnswer(
    userId: string,
    sessionId: string,
    itemId: string,
    userAnswer: string
  ): Promise<DiagnosticResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Diagnostic session '${sessionId}' not found.`);
    }
    if (session.userId !== userId) {
      throw new UnauthorizedAccessError("Access denied: You do not own this diagnostic session.");
    }
    if (session.status !== "IN_PROGRESS") {
      throw new Error(`Cannot submit answer. Session is ${session.status}.`);
    }

    const item = getDiagnosticItemById(itemId);
    if (!item) {
      throw new Error(`Diagnostic item '${itemId}' not found.`);
    }

    const evalResult = evaluateDiagnosticItem(item, userAnswer);
    const responseId = uuidv4();

    const response: DiagnosticResponse = {
      id: responseId,
      sessionId,
      userId,
      itemId,
      competencyId: item.competencyId,
      answer: userAnswer,
      isCorrect: evalResult.isCorrect,
      score: evalResult.score,
      submittedAt: new Date().toISOString(),
    };

    const sessionResponses = this.responses.get(sessionId) || [];
    // Replace if user resubmits within session, otherwise append
    const existingIndex = sessionResponses.findIndex((r) => r.itemId === itemId);
    if (existingIndex >= 0) {
      sessionResponses[existingIndex] = response;
    } else {
      sessionResponses.push(response);
    }
    this.responses.set(sessionId, sessionResponses);

    await supabasePersistence.persistDiagnosticResponse(response);

    return response;
  }

  /**
   * Completes the diagnostic, computes baseline scores, records append-only evidence,
   * and preserves baseline in competency states (§18, §19, §23).
   */
  async completeDiagnostic(
    userId: string,
    sessionId: string
  ): Promise<DiagnosticCompletionReport> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Diagnostic session '${sessionId}' not found.`);
    }
    if (session.userId !== userId) {
      throw new UnauthorizedAccessError("Access denied: You do not own this diagnostic session.");
    }
    if (session.status === "COMPLETED") {
      throw new Error("Diagnostic session has already been completed.");
    }

    const items = getDiagnosticItemsByDomain(session.domainId);
    const responses = this.responses.get(sessionId) || [];

    // Ensure all required items have answers before completing (§23)
    if (responses.length < items.length) {
      throw new Error(
        `Cannot complete diagnostic: ${responses.length}/${items.length} items answered. Incomplete sessions cannot form baseline.`
      );
    }

    const report = aggregateDiagnosticReport(
      sessionId,
      session.learningGoalId,
      session.domainId,
      session.mapVersion,
      items,
      responses
    );

    const now = new Date().toISOString();
    session.status = "COMPLETED";
    session.completedAt = now;
    session.overallBaselineScore = report.overallBaselineScore;

    await supabasePersistence.persistDiagnosticSession(session);

    // 1. Create append-only Evidence records for each response (§14, §15)
    for (const resp of responses) {
      const evidence: EvidenceRecord = {
        id: uuidv4(),
        learnerId: userId,
        competencyId: resp.competencyId,
        evidenceType: "DIAGNOSTIC",
        result: resp.isCorrect ? "SUCCESS" : "FAILURE",
        score: resp.score,
        confidence: report.competencyBaselines.find((c) => c.competencyId === resp.competencyId)?.confidence ?? 0.40,
        source: `diagnostic-session:${sessionId}`,
        timestamp: now,
        metadata: {
          sessionId,
          itemId: resp.itemId,
          mapVersion: session.mapVersion, // Map version freeze
          goalId: session.learningGoalId,
        },
        version: 1,
      };

      this.evidenceRecords.push(evidence);
      await supabasePersistence.persistEvidence({
        id: evidence.id,
        userId,
        learningGoalId: session.learningGoalId,
        competencyId: evidence.competencyId,
        evidenceType: evidence.evidenceType,
        result: evidence.result,
        score: evidence.score,
        confidence: evidence.confidence,
        source: evidence.source,
        mapVersion: session.mapVersion,
        metadata: evidence.metadata as Record<string, unknown>,
        timestamp: evidence.timestamp,
      });
    }

    // 2. Persist baseline into Competency States (§18, §19, §44)
    for (const compBase of report.competencyBaselines) {
      const stateKey = `${userId}:${session.learningGoalId}:${compBase.competencyId}`;
      const existingState = this.competencyStates.get(stateKey);

      if (existingState) {
        // PRESERVATION RULE (§44): Never overwrite existing baseline_score
        existingState.evidenceCount += compBase.evidenceCount;
        existingState.lastEvidenceAt = now;
        existingState.updatedAt = now;
        await supabasePersistence.persistCompetencyState(existingState);
      } else {
        const state: CompetencyStateEntity = {
          id: uuidv4(),
          userId,
          learningGoalId: session.learningGoalId,
          competencyId: compBase.competencyId,
          baselineScore: compBase.baselineScore, // Preserved starting point
          currentScore: compBase.baselineScore,
          masteryState: getMasteryState(compBase.baselineScore),
          confidenceScore: compBase.confidence,
          evidenceCount: compBase.evidenceCount,
          lastEvidenceAt: now,
          updatedAt: now,
        };
        this.competencyStates.set(stateKey, state);
        await supabasePersistence.persistCompetencyState(state);
      }
    }

    return report;
  }

  /**
   * Simulates later learning evidence to test baseline preservation (§44)
   */
  async recordLaterLearningEvidence(
    userId: string,
    goalId: string,
    competencyId: string,
    newScore: number
  ): Promise<void> {
    const stateKey = `${userId}:${goalId}:${competencyId}`;
    const state = this.competencyStates.get(stateKey);
    if (!state) {
      throw new Error("Competency state not found.");
    }
    if (state.userId !== userId) {
      throw new UnauthorizedAccessError();
    }

    const now = new Date().toISOString();
    const evidence: EvidenceRecord = {
      id: uuidv4(),
      learnerId: userId,
      competencyId,
      evidenceType: "EXERCISE",
      result: newScore >= 70 ? "SUCCESS" : "FAILURE",
      score: newScore,
      confidence: 0.8,
      source: "practice-exercise",
      timestamp: now,
      metadata: { goalId },
      version: 1,
    };
    this.evidenceRecords.push(evidence);
    await supabasePersistence.persistEvidence({
      id: evidence.id,
      userId,
      learningGoalId: goalId,
      competencyId,
      evidenceType: evidence.evidenceType,
      result: evidence.result,
      score: evidence.score,
      confidence: evidence.confidence,
      source: evidence.source,
      timestamp: now,
      metadata: { goalId },
    });

    // Update current score, but CRITICALLY PRESERVE baselineScore (§44)
    state.currentScore = newScore;
    state.evidenceCount += 1;
    state.lastEvidenceAt = now;
    state.updatedAt = now;
    await supabasePersistence.persistCompetencyState(state);
  }

  /**
   * Appends Feynman explanation evidence (§7)
   */
  async recordFeynmanEvidence(
    userId: string,
    goalId: string,
    competencyId: string,
    score: number,
    confidence = 0.8,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.getGoal(userId, goalId);

    const stateKey = `${userId}:${goalId}:${competencyId}`;
    const state = this.competencyStates.get(stateKey);
    const now = new Date().toISOString();

    const evidence: EvidenceRecord = {
      id: uuidv4(),
      learnerId: userId,
      competencyId,
      evidenceType: "FEYNMAN",
      result: score >= 70 ? "SUCCESS" : score >= 50 ? "PARTIAL" : "FAILURE",
      score,
      confidence,
      source: "feynman-explanation",
      timestamp: now,
      metadata: { ...metadata, goalId },
      version: 1,
    };
    this.evidenceRecords.push(evidence);
    await supabasePersistence.persistEvidence({
      id: evidence.id,
      userId,
      learningGoalId: goalId,
      competencyId,
      evidenceType: evidence.evidenceType,
      result: evidence.result,
      score: evidence.score,
      confidence: evidence.confidence,
      source: evidence.source,
      timestamp: now,
      metadata: { ...metadata, goalId },
    });

    if (state) {
      state.evidenceCount += 1;
      state.lastEvidenceAt = now;
      state.updatedAt = now;
      await supabasePersistence.persistCompetencyState(state);
    }
  }

  /**
   * Appends Spaced Repetition review evidence (§14)
   */
  async recordReviewEvidence(
    userId: string,
    goalId: string,
    competencyId: string,
    score: number,
    confidence = 0.8,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.getGoal(userId, goalId);

    const stateKey = `${userId}:${goalId}:${competencyId}`;
    const state = this.competencyStates.get(stateKey);
    const now = new Date().toISOString();

    const evidence: EvidenceRecord = {
      id: uuidv4(),
      learnerId: userId,
      competencyId,
      evidenceType: "REVIEW",
      result: score >= 70 ? "SUCCESS" : "FAILURE",
      score,
      confidence,
      source: "spaced-repetition-review",
      timestamp: now,
      metadata: { ...metadata, goalId },
      version: 1,
    };
    this.evidenceRecords.push(evidence);
    await supabasePersistence.persistEvidence({
      id: evidence.id,
      userId,
      learningGoalId: goalId,
      competencyId,
      evidenceType: evidence.evidenceType,
      result: evidence.result,
      score: evidence.score,
      confidence: evidence.confidence,
      source: evidence.source,
      timestamp: now,
      metadata: { ...metadata, goalId },
    });

    if (state) {
      state.evidenceCount += 1;
      state.lastEvidenceAt = now;
      state.updatedAt = now;
      await supabasePersistence.persistCompetencyState(state);
    }
  }

  // --- QUERY METHODS (§26) ---


  async getLearningProfile(userId: string, goalId?: string): Promise<LearningProfileEntity> {
    if (goalId) {
      await this.getGoal(userId, goalId); // Validate ownership
    }
    const profile = this.profiles.get(userId);
    if (!profile) {
      throw new Error(`Profile for user '${userId}' not found.`);
    }
    if (profile.userId !== userId) {
      throw new UnauthorizedAccessError();
    }
    return profile;
  }

  async getBaselineState(
    userId: string,
    goalId: string
  ): Promise<Record<string, { baselineScore: number; confidence: number }>> {
    await this.getGoal(userId, goalId); // Ownership check

    const result: Record<string, { baselineScore: number; confidence: number }> = {};
    for (const [key, state] of this.competencyStates.entries()) {
      if (key.startsWith(`${userId}:${goalId}:`)) {
        result[state.competencyId] = {
          baselineScore: state.baselineScore,
          confidence: state.confidenceScore,
        };
      }
    }
    return result;
  }

  async getCompetencyBaseline(
    userId: string,
    goalId: string,
    competencyId: string
  ): Promise<{ baselineScore: number; confidence: number } | null> {
    await this.getGoal(userId, goalId); // Ownership check

    const state = this.competencyStates.get(`${userId}:${goalId}:${competencyId}`);
    if (!state) return null;
    return {
      baselineScore: state.baselineScore,
      confidence: state.confidenceScore,
    };
  }

  async getDiagnosticEvidence(
    userId: string,
    goalId: string
  ): Promise<EvidenceRecord[]> {
    await this.getGoal(userId, goalId); // Ownership check

    return this.evidenceRecords.filter(
      (e) => e.learnerId === userId && e.evidenceType === "DIAGNOSTIC"
    );
  }

  async getAllEvidence(
    userId: string,
    goalId?: string
  ): Promise<EvidenceRecord[]> {
    if (goalId) {
      await this.getGoal(userId, goalId); // Ownership check
    }

    return this.evidenceRecords.filter(
      (e) => e.learnerId === userId && (!goalId || (e.metadata as Record<string, unknown>)?.goalId === goalId)
    );
  }

  async updateCompetencyMastery(
    userId: string,
    goalId: string,
    competencyId: string,
    masteryScore: number,
    masteryState: MasteryState,
    confidenceScore: number
  ): Promise<CompetencyStateEntity> {
    await this.getGoal(userId, goalId); // Ownership check

    const stateKey = `${userId}:${goalId}:${competencyId}`;
    const now = new Date().toISOString();
    const existing = this.competencyStates.get(stateKey);

    if (existing) {
      // PRESERVATION RULE (§4, §54): Never overwrite existing baselineScore
      existing.currentScore = masteryScore;
      existing.masteryState = masteryState;
      existing.confidenceScore = confidenceScore;
      existing.updatedAt = now;
      await supabasePersistence.persistCompetencyState(existing);
      return existing;
    } else {
      const state: CompetencyStateEntity = {
        id: uuidv4(),
        userId,
        learningGoalId: goalId,
        competencyId,
        baselineScore: masteryScore, // Initial baseline
        currentScore: masteryScore,
        masteryState,
        confidenceScore,
        evidenceCount: 1,
        lastEvidenceAt: now,
        updatedAt: now,
      };
      this.competencyStates.set(stateKey, state);
      await supabasePersistence.persistCompetencyState(state);
      return state;
    }
  }

  async getCurrentLearningState(
    userId: string,
    goalId: string
  ): Promise<CurrentLearningStateView> {
    const goal = await this.getGoal(userId, goalId); // Ownership check

    if (isLiveDatabaseConfigured()) {
      try {
        const client = createAdminClient();
        const [sessionRes, compRes] = await Promise.all([
          client
            .from("diagnostic_sessions")
            .select("*")
            .eq("learning_goal_id", goalId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
          client
            .from("competency_states")
            .select("*")
            .eq("learning_goal_id", goalId)
            .eq("user_id", userId),
        ]);

        if (sessionRes.data) {
          for (const row of sessionRes.data) {
            if (!this.sessions.has(row.id)) {
              this.sessions.set(row.id, {
                id: row.id,
                userId: row.user_id,
                learningGoalId: row.learning_goal_id,
                domainId: row.domain_id,
                mapVersion: row.map_version,
                status: row.status,
                overallBaselineScore: row.overall_baseline_score ?? 0,
                startedAt: row.started_at || row.created_at,
                completedAt: row.completed_at,
                itemIds: [],
              });
            }
          }
        }

        if (compRes.data) {
          for (const row of compRes.data) {
            const key = `${userId}:${goalId}:${row.competency_id}`;
            if (!this.competencyStates.has(key)) {
              this.competencyStates.set(key, {
                id: row.id,
                userId: row.user_id,
                learningGoalId: row.learning_goal_id,
                competencyId: row.competency_id,
                baselineScore: row.baseline_score ?? 0,
                currentScore: row.current_score ?? 0,
                masteryState: row.mastery_state || "UNASSESSED",
                confidenceScore: row.confidence_score ?? 0,
                evidenceCount: row.evidence_count ?? 0,
                lastEvidenceAt: row.last_evidence_at || row.updated_at,
                updatedAt: row.updated_at,
              });
            }
          }
        }
      } catch {
        // Fallback to in-memory
      }
    }

    const session = Array.from(this.sessions.values()).find(
      (s) => s.userId === userId && s.learningGoalId === goalId && s.status === "COMPLETED"
    );

    const comps: CurrentLearningStateView["competencies"] = [];
    for (const [key, state] of this.competencyStates.entries()) {
      if (key.startsWith(`${userId}:${goalId}:`)) {
        comps.push({
          competencyId: state.competencyId,
          baselineScore: state.baselineScore,
          masteryScore: state.currentScore,
          masteryState: state.masteryState,
          confidence: state.confidenceScore,
          confidenceScore: state.confidenceScore,
          evidenceCount: state.evidenceCount,
          lastEvidenceAt: state.lastEvidenceAt,
        });
      }
    }

    return {
      userId,
      goalId,
      domainId: goal.domainId,
      mapVersion: session?.mapVersion || "1.0.0",
      overallBaselineScore: session?.overallBaselineScore || 0,
      diagnosticCompleted: Boolean(session),
      competencies: comps,
    };
  }

  async getUserGoals(userId: string): Promise<LearningGoalEntity[]> {
    if (isLiveDatabaseConfigured()) {
      try {
        const client = createAdminClient();
        const { data, error } = await client
          .from("learning_goals")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (data && !error) {
          for (const row of data) {
            if (!this.goals.has(row.id)) {
              this.goals.set(row.id, {
                id: row.id,
                userId: row.user_id,
                domainId: row.domain_id,
                title: row.raw_objective || row.target_outcome || "Goal",
                normalizedObjective: typeof row.normalized_objective === "string" ? row.normalized_objective : JSON.stringify(row.normalized_objective),
                targetOutcome: row.target_outcome,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              });
            }
          }
        }
      } catch {
        // Fallback to in-memory
      }
    }

    const userGoals: LearningGoalEntity[] = [];
    for (const goal of this.goals.values()) {
      if (goal.userId === userId) {
        userGoals.push(goal);
      }
    }
    return userGoals.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getActiveGoal(
    userId: string
  ): Promise<{ goal: LearningGoalEntity; profile?: LearningProfileEntity } | null> {
    const profile = this.profiles.get(userId);
    if (profile?.activeGoalId) {
      const goal = this.goals.get(profile.activeGoalId);
      if (goal && goal.userId === userId) {
        return { goal, profile };
      }
    }

    const goals = await this.getUserGoals(userId);
    if (goals.length > 0) {
      const active = goals.find((g) => g.status === "ACTIVE") || goals[0];
      return { goal: active, profile };
    }

    return null;
  }

  async setActiveGoal(userId: string, goalId: string): Promise<LearningProfileEntity> {
    const goal = await this.getGoal(userId, goalId);
    let profile = this.profiles.get(userId);
    const now = new Date().toISOString();

    if (profile) {
      profile.activeGoalId = goal.id;
      profile.domainId = goal.domainId;
      profile.updatedAt = now;
    } else {
      profile = {
        id: uuidv4(),
        userId,
        activeGoalId: goal.id,
        domainId: goal.domainId,
        mapVersionId: "1.0.0",
        createdAt: now,
        updatedAt: now,
      };
      this.profiles.set(userId, profile);
    }

    await supabasePersistence.persistProfile(profile);
    return profile;
  }

  async recordPracticeEvidence(
    userId: string,
    goalId: string,
    competencyId: string,
    score: number,
    confidence = 0.85,
    metadata: Record<string, unknown> = {}
  ): Promise<EvidenceRecord> {
    await this.getGoal(userId, goalId);

    const stateKey = `${userId}:${goalId}:${competencyId}`;
    const state = this.competencyStates.get(stateKey);
    const now = new Date().toISOString();

    const evidence: EvidenceRecord = {
      id: uuidv4(),
      learnerId: userId,
      competencyId,
      evidenceType: "EXERCISE",
      result: score >= 70 ? "SUCCESS" : score >= 50 ? "PARTIAL" : "FAILURE",
      score,
      confidence,
      source: "practice-activity",
      timestamp: now,
      metadata: { ...metadata, goalId },
      version: 1,
    };

    this.evidenceRecords.push(evidence);
    await supabasePersistence.persistEvidence({
      id: evidence.id,
      userId,
      learningGoalId: goalId,
      competencyId,
      evidenceType: evidence.evidenceType,
      result: evidence.result,
      score: evidence.score,
      confidence: evidence.confidence,
      source: evidence.source,
      timestamp: now,
      metadata: { ...metadata, goalId },
    });

    if (state) {
      state.currentScore = score;
      state.evidenceCount += 1;
      state.lastEvidenceAt = now;
      state.updatedAt = now;
      await supabasePersistence.persistCompetencyState(state);
    } else {
      const newState: CompetencyStateEntity = {
        id: uuidv4(),
        userId,
        learningGoalId: goalId,
        competencyId,
        baselineScore: 0,
        currentScore: score,
        masteryState: getMasteryState(score),
        confidenceScore: confidence,
        evidenceCount: 1,
        lastEvidenceAt: now,
        updatedAt: now,
      };
      this.competencyStates.set(stateKey, newState);
      await supabasePersistence.persistCompetencyState(newState);
    }

    return evidence;
  }
}

const globalForState = globalThis as unknown as {
  learningStateService?: LearningStateService;
};

export const learningStateService =
  globalForState.learningStateService || new LearningStateService();

if (process.env.NODE_ENV !== "production") {
  globalForState.learningStateService = learningStateService;
}
