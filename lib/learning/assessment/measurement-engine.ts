import {
  CompetencyGainResult,
  LearningGainReport,
  RetentionReport,
} from "./types";

export interface CalculateLearningGainInput {
  learningGoalId: string;
  userId: string;
  domainId: string;
  baselineSessionId: string;
  baselineScore: number;
  finalSessionId: string;
  finalScore: number;
  baselineCompetencyScores?: Record<string, number>;
  finalCompetencyScores?: Record<string, number>;
}

export interface CalculateRetentionInput {
  learningGoalId: string;
  userId: string;
  domainId: string;
  retentionType: "D7" | "D30";
  baselineScore: number;
  finalSessionId: string;
  finalScore: number;
  retentionSessionId: string;
  retentionScore: number;
  daysSinceFinal: number;
  finalCompetencyScores?: Record<string, number>;
  retentionCompetencyScores?: Record<string, number>;
}

/**
 * Calculates deterministic Learning Gain (§7).
 * Learning Gain = Final Assessment Score - Baseline Score (Absolute Gain).
 * Relative Gain = (Final - Baseline) / (100 - Baseline) with edge-case protections.
 */
export function calculateLearningGain(
  input: CalculateLearningGainInput
): LearningGainReport {
  const {
    learningGoalId,
    userId,
    domainId,
    baselineSessionId,
    baselineScore,
    finalSessionId,
    finalScore,
    baselineCompetencyScores = {},
    finalCompetencyScores = {},
  } = input;

  const absoluteGain = Number((finalScore - baselineScore).toFixed(2));

  let relativeGain = 0;
  if (baselineScore < 100) {
    const maxPossibleGain = 100 - baselineScore;
    relativeGain = Number((absoluteGain / maxPossibleGain).toFixed(4));
    // Clamp to valid mathematical bounds [-1.0, 1.0]
    relativeGain = Math.max(-1.0, Math.min(1.0, relativeGain));
  }

  // Calculate per-competency learning gains
  const allCompIds = Array.from(
    new Set([...Object.keys(baselineCompetencyScores), ...Object.keys(finalCompetencyScores)])
  );

  const competencyGains: CompetencyGainResult[] = allCompIds.map((compId) => {
    const base = baselineCompetencyScores[compId] ?? 0;
    const final = finalCompetencyScores[compId] ?? 0;
    const gain = Number((final - base).toFixed(2));

    let status: CompetencyGainResult["status"] = "UNCHANGED";
    if (gain >= 10.0 || (final >= 80.0 && gain > 0)) {
      status = "LEARNED";
    } else if (gain <= -10.0) {
      status = "REGRESSED";
    }

    return {
      competencyId: compId,
      baselineScore: base,
      finalScore: final,
      gain,
      status,
    };
  });

  return {
    learningGoalId,
    userId,
    domainId,
    baselineSessionId,
    baselineScore,
    finalSessionId,
    finalScore,
    learningGain: absoluteGain,
    relativeGain,
    competencyGains,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Calculates knowledge & skill retention for D7 and D30 intervals (§8).
 * Avoids division-by-zero and computes guarded retention ratios.
 */
export function calculateRetention(
  input: CalculateRetentionInput
): RetentionReport {
  const {
    learningGoalId,
    userId,
    domainId,
    retentionType,
    baselineScore,
    finalSessionId,
    finalScore,
    retentionSessionId,
    retentionScore,
    daysSinceFinal,
    finalCompetencyScores = {},
    retentionCompetencyScores = {},
  } = input;

  // Guard against division by zero if finalScore == 0
  let retentionRatio = 1.0;
  if (finalScore > 0) {
    retentionRatio = Number((retentionScore / finalScore).toFixed(4));
  } else if (retentionScore > 0) {
    retentionRatio = Number(Math.min(1.0, retentionScore / 100).toFixed(4));
  }

  const gainRetained = Number((retentionScore - baselineScore).toFixed(2));

  // Competency-level retention
  const allCompIds = Array.from(
    new Set([...Object.keys(finalCompetencyScores), ...Object.keys(retentionCompetencyScores)])
  );

  const competencyRetention = allCompIds.map((compId) => {
    const final = finalCompetencyScores[compId] ?? 0;
    const ret = retentionCompetencyScores[compId] ?? 0;
    let ratio = 1.0;
    if (final > 0) {
      ratio = Number((ret / final).toFixed(4));
    } else if (ret > 0) {
      ratio = Number(Math.min(1.0, ret / 100).toFixed(4));
    }

    return {
      competencyId: compId,
      finalScore: final,
      retentionScore: ret,
      ratio,
    };
  });

  return {
    learningGoalId,
    userId,
    domainId,
    retentionType,
    finalSessionId,
    retentionSessionId,
    baselineScore,
    finalScore,
    retentionScore,
    retentionRatio,
    gainRetained,
    competencyRetention,
    daysSinceFinal,
    measuredAt: new Date().toISOString(),
  };
}
