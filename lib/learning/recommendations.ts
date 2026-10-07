import { Competency, CompetencyCategory, EvidenceType, NextBestAction } from "./types";
import { LearningGap } from "./gap-analysis";
import { PrerequisiteGraph, PrerequisiteBlockConfig, DEFAULT_PREREQUISITE_BLOCK_CONFIG } from "./prerequisite-graph";

export const RECOMMENDATION_ALGORITHM_VERSION = "v1";

/**
 * Deterministic Priority Weight Configuration (§15, §16, §43, §44)
 * Priority is strictly normalized to [0, 100].
 */
export interface RecommendationWeightsConfig {
  // Gap severity weights (max 30 points)
  gapCriticalWeight: number;
  gapHighWeight: number;
  gapMediumWeight: number;
  gapLowWeight: number;

  // Prerequisite structural impact (max 25 points)
  downstreamPerDependentWeight: number; // pts per unblocked downstream node
  maxPrerequisiteImpactWeight: number;

  // Mastery deficit weight (max 20 points)
  masteryDeficitWeight: number;
  targetMastery: number; // default 75

  // Objective alignment weight (max 15 points)
  objectiveMatchWeight: number;
  domainMatchWeight: number;

  // Recency weight (max 5 points)
  recencyWeight: number;

  // Deadline urgency weight (max 5 points)
  deadlineWeight: number;
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeightsConfig = {
  gapCriticalWeight: 30,
  gapHighWeight: 24,
  gapMediumWeight: 16,
  gapLowWeight: 8,

  downstreamPerDependentWeight: 5,
  maxPrerequisiteImpactWeight: 25,

  masteryDeficitWeight: 20,
  targetMastery: 75,

  objectiveMatchWeight: 15,
  domainMatchWeight: 10,

  recencyWeight: 5,
  deadlineWeight: 5,
};

/**
 * Configurable Effort Estimation in Minutes (§23)
 */
export const DEFAULT_ESTIMATED_MINUTES: Record<NextBestAction, number> = {
  LEARN: 25,
  PRACTICE: 20,
  FEYNMAN: 15,
  REVIEW: 10,
  RETRY: 15,
  REMEDIATE: 25,
  ADVANCE: 20,
};

export interface LearnerCompetencyState {
  competencyId: string;
  masteryScore: number;
  confidenceScore: number;
  evidenceCount: number;
  lastEvidenceAt?: string;
  lastEvidenceResult?: "SUCCESS" | "FAILURE" | "PARTIAL";
  lastEvidenceScore?: number;
  lastEvidenceType?: EvidenceType;
}

export interface LearnerObjectiveContext {
  domainId: string;
  targetOutcome?: string;
  scope?: string[] | string;
  level?: string;
  deadline?: string;
}


export interface RecommendationContext {
  userId: string;
  learningGoalId: string;
  objective: LearnerObjectiveContext;
  competencyStates: Map<string, LearnerCompetencyState>;
  gaps: Map<string, LearningGap>;
  prerequisiteGraph: PrerequisiteGraph;
  allCompetencies?: Competency[];
  weightsConfig?: RecommendationWeightsConfig;
  prereqThresholds?: PrerequisiteBlockConfig;
  referenceDate?: Date;
}

export interface CandidateRecommendation {
  competencyId: string;
  competencyTitle: string;
  category: CompetencyCategory;
  action: NextBestAction;
  priority: number;
  reason: string;
  estimatedMinutes: number;
  algorithmVersion: string;
  breakdown: {
    gapComponent: number;
    prereqComponent: number;
    deficitComponent: number;
    objectiveComponent: number;
    recencyComponent: number;
    deadlineComponent: number;
  };
}

/**
 * Pure Deterministic Action Evaluator for a specific competency (§5–12, §35–42)
 */
export function evaluateActionForCompetency(
  comp: Competency,
  state: LearnerCompetencyState | undefined,
  gap: LearningGap | undefined,
  downstreamCount: number,
  referenceDate: Date = new Date(),
  prereqThresholds: PrerequisiteBlockConfig = DEFAULT_PREREQUISITE_BLOCK_CONFIG
): { action: NextBestAction; reason: string; estimatedMinutes: number } {
  const mastery = state?.masteryScore ?? 0;
  const confidence = state?.confidenceScore ?? 0;
  const evidenceCount = state?.evidenceCount ?? 0;
  const lastResult = state?.lastEvidenceResult;
  const lastScore = state?.lastEvidenceScore;

  // 1. OPEN GAP -> REMEDIATE (§6, §38)
  if (gap && gap.status === "OPEN") {
    const signalsCount = gap.signals?.length || 2;
    const downstreamText =
      downstreamCount > 0
        ? ` It blocks ${downstreamCount} downstream ${downstreamCount === 1 ? "competency" : "competencies"}.`
        : "";
    const reason = `${comp.title} has ${mastery.toFixed(0)}% current mastery with an open ${gap.severity} gap (${signalsCount} failure signals).${downstreamText} Remediation is required to restore competency baseline.`;

    return {
      action: "REMEDIATE",
      reason,
      estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.REMEDIATE,
    };
  }

  // 2. RECENT FAILURE WITHOUT CONFIRMED GAP -> RETRY (§7)
  const hadRecentFailure = lastResult === "FAILURE" || (lastScore !== undefined && lastScore < 60);
  if (hadRecentFailure && (!gap || gap.status !== "OPEN") && evidenceCount < 2) {
    const scoreText = lastScore !== undefined ? ` (score: ${lastScore.toFixed(0)}%)` : "";
    const reason = `Recent attempt on ${comp.title} was unsuccessful${scoreText} without an established gap; an immediate retry will clarify your state.`;

    return {
      action: "RETRY",
      reason,
      estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.RETRY,
    };
  }

  // 3. KNOWLEDGE DECAY / RETENTION REVIEW DUE -> REVIEW (§8)
  // If mastery was previously good/developing (>= 65), but evidence is old (> 14 days)
  if (mastery >= 65 && state?.lastEvidenceAt) {
    const lastDate = new Date(state.lastEvidenceAt);
    const diffDays = Math.max(0, (referenceDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 14) {
      const reason = `Evidence indicates knowledge decay for ${comp.title} (${Math.floor(diffDays)} days since last assessment). A targeted review will reinforce retention.`;
      return {
        action: "REVIEW",
        reason,
        estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.REVIEW,
      };
    }
  }

  // 4. CONFLICTING STATE: HIGH MASTERY BUT LOW CONFIDENCE (§36)
  // If mastery satisfies threshold (>= 75) but confidence is weak (< 0.65)
  if (mastery >= prereqThresholds.minimumMastery && confidence < prereqThresholds.minimumConfidence) {
    if (comp.category === "CONCEPTUAL") {
      const reason = `${comp.title} demonstrates ${mastery.toFixed(0)}% mastery but evidence confidence is limited (${(confidence * 100).toFixed(0)}%). Feynman explanation is recommended to confirm conceptual depth.`;
      return {
        action: "FEYNMAN",
        reason,
        estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.FEYNMAN,
      };
    } else {
      const reason = `${comp.title} demonstrates ${mastery.toFixed(0)}% mastery but evidence confidence is limited (${(confidence * 100).toFixed(0)}%). Additional practice is recommended to solidify execution.`;
      return {
        action: "PRACTICE",
        reason,
        estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.PRACTICE,
      };
    }
  }

  // 5. DEVELOPING MASTERY: CATEGORY-SPECIFIC APPLICATION (§9, §10, §40, §41)
  if (mastery >= 60 && mastery < prereqThresholds.minimumMastery) {
    if (comp.category === "CONCEPTUAL") {
      const reason = `${comp.title} is a conceptual competency with developing mastery (${mastery.toFixed(0)}%). Explaining core mechanisms using the Feynman technique will eliminate latent confusion.`;
      return {
        action: "FEYNMAN",
        reason,
        estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.FEYNMAN,
      };
    } else {
      // PROCEDURAL & FACTUAL -> PRACTICE
      const reason = `${comp.title} is a ${comp.category.toLowerCase()} competency with developing mastery (${mastery.toFixed(0)}%). Practical exercise application is recommended to build fluency.`;
      return {
        action: "PRACTICE",
        reason,
        estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.PRACTICE,
      };
    }
  }

  // 6. LOW OR ZERO MASTERY -> LEARN (§11, §42)
  if (mastery < 60 && (!gap || gap.status !== "OPEN")) {
    const reason = `Prerequisites are satisfied for ${comp.title}. New foundational instruction is recommended to establish initial competency.`;
    return {
      action: "LEARN",
      reason,
      estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.LEARN,
    };
  }

  // 7. SUFFICIENT MASTERY AND CONFIDENCE -> ADVANCE (§12, §37)
  const reason = `${comp.title} meets target mastery (${mastery.toFixed(0)}%) and confidence (${(confidence * 100).toFixed(0)}%). Ready to advance to subsequent curriculum milestones.`;
  return {
    action: "ADVANCE",
    reason,
    estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.ADVANCE,
  };
}

/**
 * Pure Deterministic Priority Calculation (§15, §16, §43, §44)
 * Combines 6 transparent factors into a 0–100 score.
 */
export function calculatePriorityScore(
  comp: Competency,
  action: NextBestAction,
  state: LearnerCompetencyState | undefined,
  gap: LearningGap | undefined,
  downstreamCount: number,
  objective: LearnerObjectiveContext,
  weights: RecommendationWeightsConfig = DEFAULT_RECOMMENDATION_WEIGHTS,
  referenceDate: Date = new Date()
): { priority: number; breakdown: CandidateRecommendation["breakdown"] } {
  const mastery = state?.masteryScore ?? 0;

  // 1. Gap Severity Component (0 to 30)
  let gapComponent = 0;
  if (gap && gap.status === "OPEN") {
    switch (gap.severity) {
      case "CRITICAL":
        gapComponent = weights.gapCriticalWeight;
        break;
      case "HIGH":
        gapComponent = weights.gapHighWeight;
        break;
      case "MEDIUM":
        gapComponent = weights.gapMediumWeight;
        break;
      case "LOW":
        gapComponent = weights.gapLowWeight;
        break;
    }
  }

  // 2. Prerequisite Structural Impact Component (0 to 25) (§44, §61)
  const prereqComponent = Math.min(
    weights.maxPrerequisiteImpactWeight,
    downstreamCount * weights.downstreamPerDependentWeight
  );

  // 3. Mastery Deficit Component (0 to 20)
  const deficitRatio = Math.max(0, (weights.targetMastery - mastery) / weights.targetMastery);
  const deficitComponent = Number((Math.min(1, deficitRatio) * weights.masteryDeficitWeight).toFixed(2));

  // 4. Objective Alignment Component (0 to 15) (§20, §21, §61)
  let objectiveComponent = 0;
  const targetOutcomeNormalized = (objective.targetOutcome || "").toLowerCase();
  const compTitleNormalized = comp.title.toLowerCase();
  const compIdNormalized = comp.id.toLowerCase();

  const isScopeMatch =
    Array.isArray(objective.scope)
      ? objective.scope.some((s) => compIdNormalized.includes(s.toLowerCase()))
      : typeof objective.scope === "string"
      ? compIdNormalized.includes(objective.scope.toLowerCase()) ||
        (objective.scope === "FOUNDATIONAL" && comp.difficulty <= 2) ||
        (objective.scope === "INTERMEDIATE" && comp.difficulty === 3)
      : false;
  const isTitleMatch =
    targetOutcomeNormalized.length > 0 &&
    (targetOutcomeNormalized.includes(compTitleNormalized) ||
      compTitleNormalized.includes(targetOutcomeNormalized));

  if (isScopeMatch || isTitleMatch) {
    objectiveComponent = weights.objectiveMatchWeight;
  } else if (comp.domainId === objective.domainId) {
    objectiveComponent = weights.domainMatchWeight;
  }


  // 5. Recency Component (0 to 5)
  let recencyComponent = 0;
  if (action === "RETRY" || action === "REMEDIATE") {
    recencyComponent = weights.recencyWeight;
  } else if (action === "REVIEW") {
    recencyComponent = weights.recencyWeight;
  }

  // 6. Deadline Urgency Component (0 to 5) (§22)
  let deadlineComponent = 0;
  if (objective.deadline) {
    const deadlineDate = new Date(objective.deadline);
    const daysRemaining = Math.max(0, (deadlineDate.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining <= 7) {
      deadlineComponent = weights.deadlineWeight;
    } else if (daysRemaining <= 21) {
      deadlineComponent = Math.round(weights.deadlineWeight * 0.6);
    } else if (daysRemaining <= 45) {
      deadlineComponent = Math.round(weights.deadlineWeight * 0.3);
    }
  }

  // Total Priority Score (0–100)
  const rawTotal =
    gapComponent +
    prereqComponent +
    deficitComponent +
    objectiveComponent +
    recencyComponent +
    deadlineComponent;

  const priority = Number(Math.min(100, Math.max(0, rawTotal)).toFixed(2));

  return {
    priority,
    breakdown: {
      gapComponent,
      prereqComponent,
      deficitComponent,
      objectiveComponent,
      recencyComponent,
      deadlineComponent,
    },
  };
}
