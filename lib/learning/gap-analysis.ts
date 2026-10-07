import { randomUUID as uuidv4 } from "crypto";
import { CompetencyCategory, EvidenceRecord } from "./types";
import { MasteryCalculationOutput } from "./mastery";
import { PrerequisiteGraph } from "./prerequisite-graph";

export type GapStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type GapSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface GapSignal {
  type:
    | "DIAGNOSTIC_WEAKNESS"
    | "EXERCISE_FAILURE"
    | "REVIEW_FAILURE"
    | "APPLICATION_FAILURE"
    | "PERSISTENT_LOW_MASTERY"
    | "CRITICAL_PREREQUISITE_DEFICIT";
  description: string;
  observedScore: number;
  timestamp?: string;
}

export interface LearningGap {
  id: string;
  userId: string;
  learningGoalId: string;
  competencyId: string;
  severity: GapSeverity;
  masteryScore: number;
  confidenceScore: number;
  signals: GapSignal[];
  reason: string;
  status: GapStatus;
  detectedAt: string;
  resolvedAt?: string;
  version: number;
}

export interface GapDetectionContext {
  userId: string;
  learningGoalId: string;
  competencyId: string;
  category: CompetencyCategory;
  masteryOutput: MasteryCalculationOutput;
  evidenceList: EvidenceRecord[];
  prerequisiteGraph?: PrerequisiteGraph;
  existingGap?: LearningGap;
}

/**
 * Deterministic Gap Detection Engine (§18, §22, §23, §27, §28)
 * Requires at least TWO independent negative signals to declare a gap (avoiding false positives from single mistakes).
 * Integrates structural prerequisite importance from S2 DAG.
 */
export function evaluateLearningGap(context: GapDetectionContext): LearningGap | null {
  const {
    userId,
    learningGoalId,
    competencyId,
    masteryOutput,
    evidenceList,
    prerequisiteGraph,
    existingGap,
  } = context;

  const now = new Date().toISOString();
  const masteryScore = masteryOutput.masteryScore;
  const confidenceScore = masteryOutput.confidenceScore;

  // 1. GAP RESOLUTION CHECK (§29)
  // If a gap exists and learner currently demonstrates satisfactory mastery (>= 70), mark RESOLVED.
  if (existingGap && existingGap.status === "OPEN" && masteryScore >= 70) {
    return {
      ...existingGap,
      masteryScore,
      confidenceScore,
      status: "RESOLVED",
      resolvedAt: now,
      version: existingGap.version + 1,
    };
  }

  // 2. FALSE POSITIVE PROTECTION (§28)
  // An isolated single observation must NEVER produce a gap.
  if (evidenceList.length < 2) {
    return existingGap || null;
  }

  // 3. EXTRACT INDEPENDENT SIGNALS (§22)
  const signals: GapSignal[] = [];

  // Signal A: Diagnostic weakness
  const diagnosticEvs = evidenceList.filter((e) => e.evidenceType === "DIAGNOSTIC");
  if (diagnosticEvs.length > 0) {
    const diagAvg = diagnosticEvs.reduce((a, b) => a + b.score, 0) / diagnosticEvs.length;
    if (diagAvg < 60) {
      signals.push({
        type: "DIAGNOSTIC_WEAKNESS",
        description: `Baseline diagnostic weakness (${diagAvg.toFixed(0)}%)`,
        observedScore: Number(diagAvg.toFixed(1)),
        timestamp: diagnosticEvs[diagnosticEvs.length - 1].timestamp,
      });
    }
  }

  // Signal B: Exercise or practice failures
  const exerciseEvs = evidenceList.filter(
    (e) => e.evidenceType === "EXERCISE" || e.evidenceType === "PRACTICE"
  );
  if (exerciseEvs.length > 0) {
    const recentExercise = exerciseEvs[exerciseEvs.length - 1];
    if (recentExercise.score < 60) {
      signals.push({
        type: "EXERCISE_FAILURE",
        description: `Recent exercise score below threshold (${recentExercise.score.toFixed(0)}%)`,
        observedScore: recentExercise.score,
        timestamp: recentExercise.timestamp,
      });
    }
  }

  // Signal C: Review failures
  const reviewEvs = evidenceList.filter((e) => e.evidenceType === "REVIEW");
  if (reviewEvs.length > 0) {
    const recentReview = reviewEvs[reviewEvs.length - 1];
    if (recentReview.score < 60) {
      signals.push({
        type: "REVIEW_FAILURE",
        description: `Recent review recall below threshold (${recentReview.score.toFixed(0)}%)`,
        observedScore: recentReview.score,
        timestamp: recentReview.timestamp,
      });
    }
  }

  // Signal D: Application failures
  const appEvs = evidenceList.filter((e) => e.evidenceType === "APPLICATION");
  if (appEvs.length > 0) {
    const recentApp = appEvs[appEvs.length - 1];
    if (recentApp.score < 60) {
      signals.push({
        type: "APPLICATION_FAILURE",
        description: `Practical application performance below threshold (${recentApp.score.toFixed(0)}%)`,
        observedScore: recentApp.score,
        timestamp: recentApp.timestamp,
      });
    }
  }

  // Signal E: Overall low mastery across multiple observations
  if (masteryScore < 60 && evidenceList.length >= 2) {
    signals.push({
      type: "PERSISTENT_LOW_MASTERY",
      description: `Current estimated mastery is low (${masteryScore.toFixed(0)}%)`,
      observedScore: masteryScore,
      timestamp: now,
    });
  }

  // Signal F: Prerequisite Structural Deficit (§26)
  // Check if this competency unblocks downstream nodes in the prerequisite DAG
  let downstreamCount = 0;
  if (prerequisiteGraph) {
    downstreamCount = prerequisiteGraph.getDirectDependents(competencyId).length;
    if (downstreamCount > 0 && masteryScore < 65) {
      signals.push({
        type: "CRITICAL_PREREQUISITE_DEFICIT",
        description: `Prerequisite for ${downstreamCount} downstream competencies with insufficient mastery (${masteryScore.toFixed(0)}%)`,
        observedScore: masteryScore,
        timestamp: now,
      });
    }
  }

  // MULTI-SIGNAL THRESHOLD:
  // Must have at least 2 independent signals to declare a gap (§22)
  if (signals.length < 2) {
    // If an existing open gap had only 1 signal now (improving), keep existing or resolve
    return existingGap || null;
  }

  // 4. DETERMINE SEVERITY (§25, §26)
  let severity: GapSeverity = "MEDIUM";
  if (masteryScore < 40 && (downstreamCount > 0 || signals.length >= 3)) {
    severity = "CRITICAL";
  } else if (masteryScore < 50 || downstreamCount >= 2) {
    severity = "HIGH";
  } else if (masteryScore < 60) {
    severity = "MEDIUM";
  } else {
    severity = "LOW";
  }

  // 5. DETERMINISTIC EXPLANATION (§27)
  const signalDescriptions = signals.map((s) => s.description).join("; ");
  const reason = `Learning gap detected: Current mastery is ${masteryScore.toFixed(0)}% supported by ${signals.length} independent signals: ${signalDescriptions}.`;

  if (existingGap) {
    // Reopen or update existing gap (§30)
    return {
      ...existingGap,
      masteryScore,
      confidenceScore,
      severity,
      signals,
      reason,
      status: "OPEN",
      resolvedAt: undefined,
      version: existingGap.version + 1,
    };
  }

  return {
    id: uuidv4(),
    userId,
    learningGoalId,
    competencyId,
    severity,
    masteryScore,
    confidenceScore,
    signals,
    reason,
    status: "OPEN",
    detectedAt: now,
    version: 1,
  };
}
