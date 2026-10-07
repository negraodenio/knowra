import { createAdminClient } from "./supabase-admin";
import { logger } from "../observability/logger";

export function isLiveDatabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
    !url.includes("placeholder") &&
    key &&
    key.length > 20 &&
    !key.includes("your-service-role-key")
  );
}

export class SupabasePersistence {
  private getClient() {
    if (!isLiveDatabaseConfigured()) {
      return null;
    }
    try {
      return createAdminClient();
    } catch {
      return null;
    }
  }

  async persistGoal(goal: {
    id: string;
    userId: string;
    domainId: string;
    title: string;
    normalizedObjective: string;
    targetOutcome?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("learning_goals").upsert({
        id: goal.id,
        user_id: goal.userId,
        domain_id: goal.domainId,
        raw_objective: goal.title,
        normalized_objective: goal.normalizedObjective,
        target_outcome: goal.targetOutcome || goal.title,
        status: goal.status,
        created_at: goal.createdAt,
        updated_at: goal.updatedAt,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist goal", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting goal", { error: String(err) });
    }
  }

  async persistProfile(profile: {
    id: string;
    userId: string;
    activeGoalId: string;
    domainId: string;
    mapVersionId: string;
    selfReportedLevel?: string;
    targetOutcome?: string;
    createdAt: string;
    updatedAt: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("learning_profiles").upsert(
        {
          id: profile.id,
          user_id: profile.userId,
          active_goal_id: profile.activeGoalId,
          domain_id: profile.domainId,
          map_version_id: profile.mapVersionId,
          self_reported_level: profile.selfReportedLevel || null,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        },
        { onConflict: "user_id" }
      );
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist profile", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting profile", { error: String(err) });
    }
  }

  async persistDiagnosticSession(session: {
    id: string;
    userId: string;
    learningGoalId: string;
    domainId: string;
    mapVersion: string;
    status: string;
    overallBaselineScore?: number;
    startedAt: string;
    completedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("diagnostic_sessions").upsert({
        id: session.id,
        user_id: session.userId,
        learning_goal_id: session.learningGoalId,
        domain_id: session.domainId,
        map_version: session.mapVersion,
        status: session.status,
        overall_baseline_score: session.overallBaselineScore ?? null,
        started_at: session.startedAt,
        completed_at: session.completedAt || null,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist diagnostic session", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting diagnostic session", { error: String(err) });
    }
  }

  async persistDiagnosticResponse(resp: {
    sessionId: string;
    userId: string;
    itemId: string;
    competencyId: string;
    answer: string;
    isCorrect: boolean;
    score: number;
    responseTimeMs?: number;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("diagnostic_responses").insert({
        session_id: resp.sessionId,
        user_id: resp.userId,
        item_id: resp.itemId,
        competency_id: resp.competencyId,
        answer: resp.answer,
        is_correct: resp.isCorrect,
        score: resp.score,
        response_time_ms: resp.responseTimeMs ?? null,
        submitted_at: new Date().toISOString(),
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist diagnostic response", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting diagnostic response", { error: String(err) });
    }
  }

  async persistCompetencyState(state: {
    userId: string;
    learningGoalId: string;
    competencyId: string;
    baselineScore?: number;
    currentScore: number;
    masteryState: string;
    confidenceScore: number;
    evidenceCount: number;
    lastEvidenceAt?: string;
    updatedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("competency_states").upsert(
        {
          user_id: state.userId,
          learning_goal_id: state.learningGoalId,
          competency_id: state.competencyId,
          baseline_score: state.baselineScore ?? null,
          mastery_score: state.currentScore,
          mastery_state: state.masteryState,
          confidence: state.confidenceScore,
          evidence_count: state.evidenceCount,
          last_evaluated_at: state.lastEvidenceAt,
          updated_at: state.updatedAt,
        },
        { onConflict: "user_id,competency_id" }
      );
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist competency state", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting competency state", { error: String(err) });
    }
  }

  async persistEvidence(record: {
    id?: string;
    userId: string;
    learningGoalId?: string;
    competencyId: string;
    evidenceType: string;
    result: string;
    score: number;
    confidence: number;
    source: string;
    mapVersion?: string;
    metadata?: Record<string, unknown>;
    timestamp?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const payload: Record<string, unknown> = {
        user_id: record.userId,
        learning_goal_id: record.learningGoalId || null,
        competency_id: record.competencyId,
        evidence_type: record.evidenceType,
        result: record.result,
        score: record.score,
        confidence: record.confidence,
        source: record.source,
        map_version: record.mapVersion || "1.0.0",
        metadata: record.metadata || {},
        created_at: record.timestamp || new Date().toISOString(),
      };
      if (record.id) {
        payload.id = record.id;
      }
      const { error } = await client.from("evidence").insert(payload);
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist evidence", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting evidence", { error: String(err) });
    }
  }

  async persistMasterySnapshot(snapshot: {
    userId: string;
    learningGoalId?: string;
    competencyId: string;
    masteryScore: number;
    masteryState?: string;
    confidence: number;
    snapshotReason: string;
    calculationVersion?: string;
    evidenceSummary?: Record<string, unknown>;
    createdAt: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("mastery_snapshots").insert({
        user_id: snapshot.userId,
        learning_goal_id: snapshot.learningGoalId || null,
        competency_id: snapshot.competencyId,
        mastery_score: snapshot.masteryScore,
        mastery_state: snapshot.masteryState || "DEVELOPING",
        confidence: snapshot.confidence,
        snapshot_reason: snapshot.snapshotReason,
        calculation_version: snapshot.calculationVersion || "v1",
        evidence_summary: snapshot.evidenceSummary || {},
        created_at: snapshot.createdAt,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist snapshot", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting snapshot", { error: String(err) });
    }
  }

  async persistGap(gap: {
    id: string;
    userId: string;
    learningGoalId?: string;
    competencyId: string;
    severity: number | string;
    severityLevel?: string;
    reason: string;
    status: string;
    signals?: unknown[];
    version?: number;
    detectedAt: string;
    resolvedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    const numSeverity = typeof gap.severity === "number"
      ? gap.severity
      : gap.severity === "CRITICAL" ? 0.9 : gap.severity === "HIGH" ? 0.7 : gap.severity === "MEDIUM" ? 0.5 : 0.3;
    const level = gap.severityLevel || (typeof gap.severity === "string" ? gap.severity : "MEDIUM");

    try {
      const { error } = await client.from("gaps").upsert({
        id: gap.id,
        user_id: gap.userId,
        learning_goal_id: gap.learningGoalId || null,
        competency_id: gap.competencyId,
        severity: numSeverity,
        severity_level: level,
        reason: gap.reason,
        status: gap.status,
        signals: gap.signals || [],
        version: gap.version || 1,
        detected_at: gap.detectedAt,
        resolved_at: gap.resolvedAt || null,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist gap", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting gap", { error: String(err) });
    }
  }

  async persistRecommendation(rec: {
    id: string;
    userId: string;
    learningGoalId?: string;
    action: string;
    competencyId: string;
    priority: number;
    reason: string;
    estimatedMinutes: number;
    status: string;
    algorithmVersion?: string;
    createdAt: string;
    updatedAt: string;
    presentedAt?: string;
    acceptedAt?: string;
    skippedAt?: string;
    completedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("recommendations").upsert({
        id: rec.id,
        user_id: rec.userId,
        learning_goal_id: rec.learningGoalId || null,
        action: rec.action,
        competency_id: rec.competencyId,
        priority: rec.priority,
        reason: rec.reason,
        estimated_minutes: rec.estimatedMinutes,
        status: rec.status,
        algorithm_version: rec.algorithmVersion || "v1",
        created_at: rec.createdAt,
        updated_at: rec.updatedAt,
        presented_at: rec.presentedAt || null,
        accepted_at: rec.acceptedAt || null,
        skipped_at: rec.skippedAt || null,
        completed_at: rec.completedAt || null,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist recommendation", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting recommendation", { error: String(err) });
    }
  }

  async persistReviewItem(item: {
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
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("review_items").upsert({
        id: item.id,
        user_id: item.userId,
        learning_goal_id: item.learningGoalId,
        competency_id: item.competencyId,
        scheduler_type: item.schedulerType,
        scheduler_version: item.schedulerVersion,
        scheduler_state: item.schedulerState,
        due_at: item.dueAt,
        last_reviewed_at: item.lastReviewedAt || null,
        review_count: item.reviewCount,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist review item", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting review item", { error: String(err) });
    }
  }

  async persistReviewSession(session: {
    id: string;
    userId: string;
    learningGoalId: string;
    itemCount: number;
    completedCount: number;
    score?: number;
    status: string;
    startedAt: string;
    completedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("review_sessions").upsert({
        id: session.id,
        user_id: session.userId,
        learning_goal_id: session.learningGoalId,
        item_count: session.itemCount,
        completed_count: session.completedCount,
        score: session.score ?? null,
        status: session.status,
        started_at: session.startedAt,
        completed_at: session.completedAt || null,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist review session", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting review session", { error: String(err) });
    }
  }

  async persistFeynmanSession(session: {
    id: string;
    userId: string;
    learningGoalId: string;
    competencyId: string;
    prompt: string;
    learnerExplanation?: string;
    evaluation?: unknown;
    status: string;
    algorithmVersion: string;
    createdAt: string;
    submittedAt?: string;
    evaluatedAt?: string;
  }): Promise<void> {
    const client = this.getClient();
    if (!client) return;

    try {
      const { error } = await client.from("feynman_sessions").upsert({
        id: session.id,
        user_id: session.userId,
        learning_goal_id: session.learningGoalId,
        competency_id: session.competencyId,
        prompt: session.prompt,
        learner_explanation: session.learnerExplanation || null,
        evaluation: session.evaluation || null,
        status: session.status,
        algorithm_version: session.algorithmVersion,
        created_at: session.createdAt,
        submitted_at: session.submittedAt || null,
        evaluated_at: session.evaluatedAt || null,
      });
      if (error) {
        logger.warn("SupabasePersistence: Failed to persist feynman session", { error: error.message });
      }
    } catch (err) {
      logger.warn("SupabasePersistence: Error persisting feynman session", { error: String(err) });
    }
  }
}

export const supabasePersistence = new SupabasePersistence();
