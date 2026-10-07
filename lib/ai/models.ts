/**
 * Model Strategy & Task-to-Model Resolver (§29)
 * Reads task configurations from environment variables with sensible defaults.
 * Decouples application logic from any hardcoded model provider.
 */

export type AITask =
  | "TUTOR"
  | "FEYNMAN"
  | "CLASSIFIER"
  | "DIAGNOSTIC"
  | "PLAN"
  | "COMPETENCY"
  | "ASSESSMENT"
  | "MATERIAL";

export interface ModelPricing {
  promptTokenPricePerMillion: number;
  completionTokenPricePerMillion: number;
}

export const KNOWN_MODEL_PRICING: Record<string, ModelPricing> = {
  "openai/gpt-4o-mini": {
    promptTokenPricePerMillion: 0.15,
    completionTokenPricePerMillion: 0.6,
  },
  "openai/gpt-4o": {
    promptTokenPricePerMillion: 2.5,
    completionTokenPricePerMillion: 10.0,
  },
  "anthropic/claude-3.5-sonnet": {
    promptTokenPricePerMillion: 3.0,
    completionTokenPricePerMillion: 15.0,
  },
  "deepseek/deepseek-chat": {
    promptTokenPricePerMillion: 0.14,
    completionTokenPricePerMillion: 0.28,
  },
};

const DEFAULT_PRICING: ModelPricing = {
  promptTokenPricePerMillion: 1.0,
  completionTokenPricePerMillion: 3.0,
};

export function getModelForTask(task: AITask): string {
  const envMap: Record<AITask, string | undefined> = {
    TUTOR: process.env.TUTOR_MODEL,
    FEYNMAN: process.env.FEYNMAN_MODEL,
    CLASSIFIER: process.env.CLASSIFIER_MODEL,
    DIAGNOSTIC: process.env.DIAGNOSTIC_MODEL,
    PLAN: process.env.PLAN_MODEL,
    COMPETENCY: process.env.COMPETENCY_MODEL,
    ASSESSMENT: process.env.ASSESSMENT_MODEL,
    MATERIAL: process.env.MATERIAL_MODEL,
  };

  const defaultMap: Record<AITask, string> = {
    TUTOR: "anthropic/claude-3.5-sonnet",
    FEYNMAN: "anthropic/claude-3.5-sonnet",
    CLASSIFIER: "openai/gpt-4o-mini",
    DIAGNOSTIC: "openai/gpt-4o-mini",
    PLAN: "anthropic/claude-3.5-sonnet",
    COMPETENCY: "anthropic/claude-3.5-sonnet",
    ASSESSMENT: "openai/gpt-4o",
    MATERIAL: "openai/gpt-4o-mini",
  };

  return envMap[task] || defaultMap[task];
}

export function calculateEstimatedCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = KNOWN_MODEL_PRICING[model] || DEFAULT_PRICING;
  const inputCost = (promptTokens / 1_000_000) * pricing.promptTokenPricePerMillion;
  const outputCost = (completionTokens / 1_000_000) * pricing.completionTokenPricePerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
