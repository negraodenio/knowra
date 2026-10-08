import {
  AssessmentItem,
  AssessmentResponse,
  AssessmentScoreResult,
  CompetencyAssessmentScore,
} from "./types";

export interface ItemEvaluationResult {
  isCorrect: boolean;
  score: number; // 0 to 100
}

/**
 * Deterministic Assessment Evaluator (§2, §5)
 * Evaluates assessment items deterministically based on type without LLM drift.
 */
export function evaluateAssessmentItem(
  item: AssessmentItem,
  userAnswer: string
): ItemEvaluationResult {
  const cleanAnswer = userAnswer.trim();
  const cleanExpected = item.correctAnswer.trim();

  switch (item.itemType) {
    case "MULTIPLE_CHOICE": {
      const isCorrect = cleanAnswer.toLowerCase() === cleanExpected.toLowerCase();
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    case "TRUE_FALSE": {
      const normalizedUser =
        cleanAnswer.toLowerCase() === "true" || cleanAnswer.toLowerCase() === "t";
      const normalizedExpected =
        cleanExpected.toLowerCase() === "true" || cleanExpected.toLowerCase() === "t";
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

      const isCorrect = Math.abs(numUser - numExpected) < 0.001;
      return { isCorrect, score: isCorrect ? 100 : 0 };
    }

    case "SHORT_ANSWER": {
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
 * Aggregates item evaluations into reproducible session and competency scores (§5, §8).
 * Overall score is normalized between 0 and 100.
 */
export function scoreAssessmentSession(
  items: AssessmentItem[],
  responses: AssessmentResponse[]
): AssessmentScoreResult {
  const itemMap = new Map<string, AssessmentItem>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }

  const itemEvaluations: AssessmentScoreResult["itemEvaluations"] = [];
  const competencyTotals: Record<string, { totalScore: number; count: number; correctCount: number }> = {};

  let totalSessionScore = 0;

  for (const resp of responses) {
    const item = itemMap.get(resp.itemId);
    const competencyId = resp.competencyId || item?.competencyId || "unknown";

    itemEvaluations.push({
      itemId: resp.itemId,
      competencyId,
      isCorrect: resp.isCorrect,
      score: resp.score,
    });

    totalSessionScore += resp.score;

    if (!competencyTotals[competencyId]) {
      competencyTotals[competencyId] = { totalScore: 0, count: 0, correctCount: 0 };
    }
    competencyTotals[competencyId].totalScore += resp.score;
    competencyTotals[competencyId].count += 1;
    if (resp.isCorrect) {
      competencyTotals[competencyId].correctCount += 1;
    }
  }

  const overallScore =
    responses.length > 0 ? Number((totalSessionScore / responses.length).toFixed(2)) : 0;

  const competencyScores: Record<string, CompetencyAssessmentScore> = {};
  for (const [compId, stats] of Object.entries(competencyTotals)) {
    const avgScore = stats.count > 0 ? Number((stats.totalScore / stats.count).toFixed(2)) : 0;
    competencyScores[compId] = {
      competencyId: compId,
      score: avgScore,
      totalItems: stats.count,
      correctItems: stats.correctCount,
    };
  }

  return {
    overallScore,
    competencyScores,
    itemEvaluations,
    scoringVersion: "v1",
  };
}
