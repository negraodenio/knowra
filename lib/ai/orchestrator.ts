import { ModelTask, models, AITask } from "./models";
import { getModelMetadata, ModelCapability } from "./capabilities";

export type RequirementLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ModelSelectionContext {
  task: ModelTask | AITask | string;
  domain?: string;
  difficulty?: number;
  latencyRequirement?: RequirementLevel;
  qualityRequirement?: RequirementLevel;
  costSensitivity?: RequirementLevel;
}

export interface ModelSelectionDecision {
  model: string;
  provider: string;
  reason: string;
  policyVersion: string;
  fallbackModel?: string;
  capabilities: ModelCapability[];
}

export const ORCHESTRATION_POLICY_VERSION = "EDUIA_POLICY_V1";

/**
 * Default pedagogical profile requirements per task (§S7.5).
 * Core Principle: QUALITY > COST for educational tasks.
 */
export const TASK_PEDAGOGICAL_PROFILES: Record<
  string,
  {
    qualityRequirement: RequirementLevel;
    costSensitivity: RequirementLevel;
    latencyRequirement: RequirementLevel;
  }
> = {
  classifier: { qualityRequirement: "MEDIUM", costSensitivity: "HIGH", latencyRequirement: "LOW" },
  tutor: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  feynman: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  diagnostic: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  assessment: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  plan: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  competency: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM" },
  material: { qualityRequirement: "MEDIUM", costSensitivity: "MEDIUM", latencyRequirement: "MEDIUM" },
};

export class AIModelOrchestrator {
  readonly policyVersion = ORCHESTRATION_POLICY_VERSION;

  /**
   * Selects which model should execute a pedagogical AI task (§S7.5).
   *
   * Strategy:
   * 1. Task-specific model environment variable (e.g. TUTOR_MODEL).
   * 2. If unconfigured or empty, fallback to DEFAULT_MODEL (Astra if configured).
   * 3. If DEFAULT_MODEL is also missing, fail explicitly.
   * NEVER silently select an arbitrary random model.
   */
  selectModel(context: ModelSelectionContext): ModelSelectionDecision {
    const normalizedTask = context.task.toLowerCase() as ModelTask;
    const taskUpper = context.task.toUpperCase();

    // 1. Check task-specific model override
    const taskEnvModel = (models as Record<string, string | undefined>)[normalizedTask];
    let selectedModel: string | undefined;
    let reason = "";

    if (taskEnvModel && typeof taskEnvModel === "string" && taskEnvModel.trim() !== "") {
      selectedModel = taskEnvModel.trim();
      reason = `Task-specific environment override configured (${taskUpper}_MODEL)`;
    } else {
      // 2. Fallback to DEFAULT_MODEL (Astra candidate if configured)
      const defaultModel = process.env.DEFAULT_MODEL?.trim();
      if (defaultModel && defaultModel !== "") {
        selectedModel = defaultModel;
        const isAstra = defaultModel.toLowerCase().includes("astra");
        reason = isAstra
          ? "Resolved from DEFAULT_MODEL (Astra default candidate)"
          : "Resolved from DEFAULT_MODEL configuration";
      }
    }

    // 3. If neither is available, fail explicitly
    if (!selectedModel || selectedModel === "") {
      throw new Error(
        `Model not configured for task: ${context.task} (no task-specific override and no DEFAULT_MODEL specified)`
      );
    }

    // 4. Resolve operational fallback model if configured
    const configuredFallback = process.env.FALLBACK_MODEL?.trim();
    let fallbackModel: string | undefined;
    if (configuredFallback && configuredFallback !== "" && configuredFallback !== selectedModel) {
      fallbackModel = configuredFallback;
    } else if (process.env.ENABLE_OPERATIONAL_FALLBACK === "true" && selectedModel !== "openai/gpt-4o-mini") {
      fallbackModel = "openai/gpt-4o-mini";
    }

    // 5. Look up capabilities and provider
    const metadata = getModelMetadata(selectedModel);

    return {
      model: selectedModel,
      provider: metadata.provider,
      reason,
      policyVersion: this.policyVersion,
      fallbackModel,
      capabilities: metadata.capabilities,
    };
  }

  /**
   * Checks whether an error is operational (eligible for model fallback)
   * vs validation/business failure (never eligible for fallback).
   */
  isOperationalError(err: unknown): boolean {
    if (!err) return false;
    const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

    // Zod validation or schema errors are NOT operational errors
    if (message.includes("schema validation") || message.includes("zod") || message.includes("json parse")) {
      return false;
    }

    // Operational failures: timeout, 404 endpoint not found, 429 rate limit, 5xx server error, network errors
    if (
      message.includes("404") ||
      message.includes("no endpoints found") ||
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504") ||
      message.includes("timeout") ||
      message.includes("aborterror") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("fetch failed") ||
      message.includes("network error")
    ) {
      return true;
    }

    return false;
  }
}

export const aiModelOrchestrator = new AIModelOrchestrator();
