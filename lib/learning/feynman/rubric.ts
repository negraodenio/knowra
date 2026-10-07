import { z } from "zod";

export const FEYNMAN_RUBRIC_VERSION = "v1";

/**
 * Versioned Feynman Rubric Weights (§6)
 * Hypothesis v1:
 * - correctness: 30%
 * - completeness: 25%
 * - causal reasoning: 20%
 * - simplicity: 10%
 * - misconception penalty: 15%
 */
export interface FeynmanRubricConfig {
  correctnessWeight: number;
  completenessWeight: number;
  causalReasoningWeight: number;
  simplicityWeight: number;
  misconceptionPenaltyWeight: number;
}

export const DEFAULT_FEYNMAN_RUBRIC: FeynmanRubricConfig = {
  correctnessWeight: 0.30,
  completenessWeight: 0.25,
  causalReasoningWeight: 0.20,
  simplicityWeight: 0.10,
  misconceptionPenaltyWeight: 0.15,
};

export const FeynmanEvaluationSchema = z.object({
  correctness: z.number().min(0).max(100),
  completeness: z.number().min(0).max(100),
  simplicity: z.number().min(0).max(100),
  causal_reasoning: z.number().min(0).max(100),
  misconception_penalty: z.number().min(0).max(100),
  overall_score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  missing_concepts: z.array(z.string()),
  misconceptions: z.array(z.string()),
  feedback: z.string().min(1),
  rubric_version: z.string().default(FEYNMAN_RUBRIC_VERSION),
});

export type FeynmanEvaluation = z.infer<typeof FeynmanEvaluationSchema>;

/**
 * Pure Deterministic Feynman Score Calculator (§5, §6, §31)
 * Enforces strict rubric weighting regardless of LLM variability.
 */
export function calculateFeynmanScore(
  components: {
    correctness: number;
    completeness: number;
    simplicity: number;
    causal_reasoning: number;
    misconception_penalty: number;
  },
  rubric: FeynmanRubricConfig = DEFAULT_FEYNMAN_RUBRIC
): number {
  const raw =
    components.correctness * rubric.correctnessWeight +
    components.completeness * rubric.completenessWeight +
    components.causal_reasoning * rubric.causalReasoningWeight +
    components.simplicity * rubric.simplicityWeight -
    components.misconception_penalty * rubric.misconceptionPenaltyWeight;

  return Math.min(100, Math.max(0, Math.round(raw)));
}
