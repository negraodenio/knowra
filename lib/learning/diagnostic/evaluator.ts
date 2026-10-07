import {
  DiagnosticItem,
  DiagnosticResponse,
  CompetencyBaselineResult,
  DiagnosticCompletionReport,
} from "./types";

export interface EvaluationResult {
  isCorrect: boolean;
  score: number; // 0 to 100
}

/**
 * Deterministic Diagnostic Evaluator (§22, §29)
 * Pure, explainable, and reproducible evaluation without LLM hallucination.
 */
export function evaluateDiagnosticItem(
  item: DiagnosticItem,
  userAnswer: string
): EvaluationResult {
  const cleanAnswer = userAnswer.trim();
  const cleanExpected = item.correctAnswer.trim();

  switch (item.itemType) {
    case "MULTIPLE_CHOICE": {
      const isCorrect = cleanAnswer.toLowerCase() === cleanExpected.toLowerCase();
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    case "TRUE_FALSE": {
      const normalizedUser = cleanAnswer.toLowerCase() === "true" || cleanAnswer.toLowerCase() === "t";
      const normalizedExpected = cleanExpected.toLowerCase() === "true" || cleanExpected.toLowerCase() === "t";
      const isCorrect = normalizedUser === normalizedExpected;
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    case "NUMERIC": {
      const numUser = parseFloat(cleanAnswer.replace(/,/g, "."));
      const numExpected = parseFloat(cleanExpected.replace(/,/g, "."));

      if (isNaN(numUser) || isNaN(numExpected)) {
        const isCorrect = cleanAnswer.toLowerCase() === cleanExpected.toLowerCase();
        return { isCorrect, score: isCorrect ? 100 : 0 };
      }

      // Small epsilon tolerance for floating-point values
      const isCorrect = Math.abs(numUser - numExpected) < 0.001;
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    case "SHORT_ANSWER": {
      // Simple normalized match (§29)
      const isCorrect = cleanAnswer.toLowerCase() === cleanExpected.toLowerCase();
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    default: {
      const isCorrect = cleanAnswer === cleanExpected;
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }
  }
}

/**
 * Calculates initial evidence confidence (§20, §21).
 * Score and confidence are strictly separated dimensions.
 * Confidence increases with multiple consistent evidence items and decreases with conflict.
 */
export function calculateInitialConfidence(
  evaluations: Array<{ isCorrect: boolean; score: number }>
): number {
  const count = evaluations.length;
  if (count === 0) return 0.0;

  if (count === 1) {
    // A single diagnostic item provides limited confidence (§21)
    return 0.40;
  }

  const correctCount = evaluations.filter((e) => e.isCorrect).length;
  const isAllSame = correctCount === 0 || correctCount === count;

  if (count === 2) {
    // If 2 items are consistent: moderate confidence. If conflicting: low confidence.
    return isAllSame ? 0.65 : 0.30;
  }

  // 3 or more items
  if (isAllSame) {
    return 0.85;
  }

  // Mixed results indicate uncertainty
  const consistencyRatio = Math.max(correctCount, count - correctCount) / count;
  return Number((0.40 + consistencyRatio * 0.35).toFixed(3));
}

/**
 * Aggregates diagnostic responses into competency-level baselines and overall baseline (§18, §19, §22)
 */
export function aggregateDiagnosticReport(
  sessionId: string,
  learningGoalId: string,
  domainId: string,
  mapVersion: string,
  items: DiagnosticItem[],
  responses: DiagnosticResponse[]
): DiagnosticCompletionReport {
  const responsesByCompetency = new Map<string, DiagnosticResponse[]>();

  for (const resp of responses) {
    if (!responsesByCompetency.has(resp.competencyId)) {
      responsesByCompetency.set(resp.competencyId, []);
    }
    responsesByCompetency.get(resp.competencyId)!.push(resp);
  }

  const competencyBaselines: CompetencyBaselineResult[] = [];
  const relativeStrengths: string[] = [];
  const lowerBaselines: string[] = []; // Explicitly avoiding the word 'gaps' in S3 (§39)

  let totalScoreSum = 0;
  let totalResponsesCount = 0;

  for (const [competencyId, resps] of responsesByCompetency.entries()) {
    const compScoreSum = resps.reduce((acc, r) => acc + r.score, 0);
    const baselineScore = Number((compScoreSum / resps.length).toFixed(2));
    const confidence = calculateInitialConfidence(resps);

    competencyBaselines.push({
      competencyId,
      baselineScore,
      confidence,
      evidenceCount: resps.length,
      evaluations: resps.map((r) => ({
        itemId: r.itemId,
        score: r.score,
        isCorrect: r.isCorrect,
      })),
    });

    totalScoreSum += compScoreSum;
    totalResponsesCount += resps.length;

    if (baselineScore >= 75) {
      relativeStrengths.push(competencyId);
    } else if (baselineScore < 60) {
      lowerBaselines.push(competencyId);
    }
  }

  const overallBaselineScore = totalResponsesCount > 0
    ? Number((totalScoreSum / totalResponsesCount).toFixed(2))
    : 0.0;

  return {
    sessionId,
    learningGoalId,
    domainId,
    mapVersion,
    overallBaselineScore,
    totalItems: items.length,
    completedItems: responses.length,
    competencyBaselines,
    relativeStrengths,
    lowerBaselines,
  };
}
