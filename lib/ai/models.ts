/**
 * Task-Specific Model Registry (§28, §29)
 * Maps pedagogical application tasks to environment-configured model IDs.
 * Model selection is completely environment-driven and task-specific.
 */

export const models = {
  get tutor() {
    return process.env.TUTOR_MODEL;
  },
  get feynman() {
    return process.env.FEYNMAN_MODEL;
  },
  get classifier() {
    return process.env.CLASSIFIER_MODEL;
  },
  get diagnostic() {
    return process.env.DIAGNOSTIC_MODEL;
  },
  get plan() {
    return process.env.PLAN_MODEL;
  },
  get competency() {
    return process.env.COMPETENCY_MODEL;
  },
  get assessment() {
    return process.env.ASSESSMENT_MODEL;
  },
  get material() {
    return process.env.MATERIAL_MODEL;
  },
} as const;

export type ModelTask = keyof typeof models;

export type AITask =
  | "TUTOR"
  | "FEYNMAN"
  | "CLASSIFIER"
  | "DIAGNOSTIC"
  | "PLAN"
  | "COMPETENCY"
  | "ASSESSMENT"
  | "MATERIAL";

/**
 * Resolves the configured model ID for a specific pedagogical task.
 * Fails clearly if the required environment variable is missing.
 * Does NOT silently fall back to arbitrary default models.
 */
export function getModel(task: ModelTask | string): string {
  const normalized = task.toLowerCase() as ModelTask;
  if (!(normalized in models)) {
    throw new Error(`Model not configured for task: ${task}`);
  }
  const model = models[normalized];
  if (!model || typeof model !== "string" || model.trim() === "") {
    throw new Error(`Model not configured for task: ${task}`);
  }
  return model.trim();
}

/**
 * Validates that all required model configurations are present.
 * Throws a clear error if any specified task is missing its model ID.
 */
export function validateModelConfig(tasks?: (ModelTask | string)[]): void {
  const targetTasks = tasks || (Object.keys(models) as ModelTask[]);
  for (const t of targetTasks) {
    getModel(t);
  }
}

/**
 * Backwards-compatibility resolver for legacy callers and S1 fixtures.
 */
export function getModelForTask(task: AITask | ModelTask | string): string {
  const normalized = task.toLowerCase() as ModelTask;
  const configured = models[normalized];
  if (configured && configured.trim() !== "") {
    return configured.trim();
  }
  const legacyDefaults: Record<ModelTask, string> = {
    tutor: "anthropic/claude-3.5-sonnet",
    feynman: "anthropic/claude-3.5-sonnet",
    classifier: "openai/gpt-4o-mini",
    diagnostic: "openai/gpt-4o-mini",
    plan: "anthropic/claude-3.5-sonnet",
    competency: "anthropic/claude-3.5-sonnet",
    assessment: "openai/gpt-4o",
    material: "openai/gpt-4o-mini",
  };
  return legacyDefaults[normalized] || getModel(task);
}

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

export { getAIConfig } from "./config";
export type { AIConfig } from "./config";
