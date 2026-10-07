import { aiGateway } from "./gateway";
import {
  FeynmanEvaluation,
  FeynmanEvaluationSchema,
  calculateFeynmanScore,
  DEFAULT_FEYNMAN_RUBRIC,
  FEYNMAN_RUBRIC_VERSION,
} from "../learning/feynman/rubric";
import { Competency } from "../learning/types";

export interface EvaluateFeynmanInput {
  competency: Competency;
  prompt: string;
  explanation: string;
  userId?: string;
}

export interface EvaluateFeynmanOutput {
  success: boolean;
  evaluation?: FeynmanEvaluation;
  error?: string;
  modelUsed?: string;
}

const FEYNMAN_PROMPT_VERSION = "FEYNMAN_EVAL_V1";

/**
 * Structured Feynman Explanation Evaluator (§5, §6, §26, §27)
 * Routes through the AI Gateway, parses structured rubric evaluation with Zod,
 * and enforces deterministic final score calculation.
 */
export async function evaluateFeynmanExplanationWithAI(
  input: EvaluateFeynmanInput
): Promise<EvaluateFeynmanOutput> {
  const { competency, prompt, explanation, userId } = input;

  // Protect against empty/trivial inputs before calling AI
  if (!explanation || explanation.trim().length < 15) {
    const fallbackEval: FeynmanEvaluation = {
      correctness: 10,
      completeness: 10,
      simplicity: 50,
      causal_reasoning: 10,
      misconception_penalty: 0,
      overall_score: calculateFeynmanScore({
        correctness: 10,
        completeness: 10,
        simplicity: 50,
        causal_reasoning: 10,
        misconception_penalty: 0,
      }),
      confidence: 0.5,
      missing_concepts: [competency.title, "Core definitions", "Examples"],
      misconceptions: ["Explanation is too brief to demonstrate conceptual understanding."],
      feedback: "Your explanation is too brief. Please elaborate on what the concept is, how it works, and provide a concrete example.",
      rubric_version: FEYNMAN_RUBRIC_VERSION,
    };

    return {
      success: true,
      evaluation: fallbackEval,
      modelUsed: "deterministic-rule-engine",
    };
  }

  const systemPrompt = `You are a pedagogical assessment evaluator for the Universal Adaptive Learning Platform.
Your task is to evaluate a learner's explanation of a specific competency using the Feynman Technique.
Evaluate the explanation according to these criteria:
1. Correctness (0-100): Accuracy of factual and conceptual statements.
2. Completeness (0-100): Whether key mechanisms and ideas are explained.
3. Simplicity (0-100): Clear, intuitive language without excessive jargon.
4. Causal Reasoning (0-100): Explains 'why' and 'how', not just definitions.
5. Misconception Penalty (0-100): 0 if none, up to 100 if major dangerous misconceptions exist.
6. Missing Concepts: List specific concepts that should have been mentioned.
7. Misconceptions: List specific false or misleading claims made.
8. Feedback: Direct, constructive pedagogical feedback highlighting strengths, gaps, and improvements.

You must respond with valid JSON matching the required schema.`;

  const userPrompt = `Target Competency:
ID: ${competency.id}
Title: ${competency.title}
Description: ${competency.description}
Category: ${competency.category}

Prompt given to learner:
"${prompt}"

Learner's Explanation:
"${explanation}"

Evaluate this explanation thoroughly.`;

  try {
    const result = await aiGateway.generateStructured({
      task: "FEYNMAN",
      systemPrompt,
      userPrompt,
      promptVersion: FEYNMAN_PROMPT_VERSION,
      schema: FeynmanEvaluationSchema,
      userId,
      temperature: 0.1,
    });

    const parsed = result.data;

    // Enforce pure deterministic overall score calculation from rubric (§5, §31)
    const deterministicScore = calculateFeynmanScore(
      {
        correctness: parsed.correctness,
        completeness: parsed.completeness,
        simplicity: parsed.simplicity,
        causal_reasoning: parsed.causal_reasoning,
        misconception_penalty: parsed.misconception_penalty,
      },
      DEFAULT_FEYNMAN_RUBRIC
    );

    const finalizedEvaluation: FeynmanEvaluation = {
      ...parsed,
      overall_score: deterministicScore,
      rubric_version: FEYNMAN_RUBRIC_VERSION,
    };

    return {
      success: true,
      evaluation: finalizedEvaluation,
      modelUsed: result.model,
    };
  } catch (err: unknown) {
    // SAFE FAILURE (§27): Return error without crashing or recording invalid evidence
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Feynman evaluation failed: ${errorMessage}`,
    };
  }
}
