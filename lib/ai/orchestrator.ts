import {
  ModelTask,
  models,
  AITask,
  getPrimaryModel,
  isAstraModel,
  isCognitiveTask,
} from "./models";
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
  primaryModel: string;
  isStrategicPrimary: boolean;
  fallbackModel?: string;
  capabilities: ModelCapability[];
}

export const ORCHESTRATION_POLICY_VERSION = "EDUIA_POLICY_V2";

/**
 * Default pedagogical profile requirements per task (§S7.5, §S7.7).
 * Core Principle: QUALITY > COST for educational tasks.
 * Astra is the intended primary model for cognitively important tasks.
 */
export const TASK_PEDAGOGICAL_PROFILES: Record<
  string,
  {
    qualityRequirement: RequirementLevel;
    costSensitivity: RequirementLevel;
    latencyRequirement: RequirementLevel;
    isCognitive: boolean;
  }
> = {
  classifier: { qualityRequirement: "MEDIUM", costSensitivity: "HIGH", latencyRequirement: "LOW", isCognitive: false },
  tutor: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  feynman: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  diagnostic: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  assessment: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  plan: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  competency: { qualityRequirement: "HIGH", costSensitivity: "LOW", latencyRequirement: "MEDIUM", isCognitive: true },
  material: { qualityRequirement: "HIGH", costSensitivity: "MEDIUM", latencyRequirement: "MEDIUM", isCognitive: false },
};

export class AIModelOrchestrator {
  readonly policyVersion = ORCHESTRATION_POLICY_VERSION;

  /**
   * Selects which model should execute a pedagogical AI task (§S7.5, §S7.7).
   *
   * Astra-First Selection Policy (EDUIA_POLICY_V2):
   * 1. Cognitively important tasks (TUTOR, FEYNMAN, DIAGNOSTIC, ASSESSMENT, PLAN, COMPETENCY):
   *    explicit task model (e.g. TUTOR_MODEL) -> EDUIA_PRIMARY_MODEL (Astra) -> explicit error.
   * 2. Low-risk tasks (CLASSIFIER, MATERIAL):
   *    explicit task model -> policy-approved cheaper model -> EDUIA_PRIMARY_MODEL.
   * 3. Operational fallback (FALLBACK_MODEL) is strictly for infrastructure failures and NEVER
   *    redefines the strategic default.
   * 4. GPT-4o-mini is an operational fallback / low-risk optimization candidate, NEVER the strategic default.
   */
  selectModel(context: ModelSelectionContext): ModelSelectionDecision {
    const normalizedTask = context.task.toLowerCase() as ModelTask;
    const taskUpper = context.task.toUpperCase();
    const isCognitive = isCognitiveTask(normalizedTask);

    // 1. Check task-specific model override
    const taskEnvModel = (models as Record<string, string | undefined>)[normalizedTask];
    let selectedModel: string | undefined;
    let reason = "";

    const strategicPrimary = getPrimaryModel();

    if (taskEnvModel && typeof taskEnvModel === "string" && taskEnvModel.trim() !== "") {
      selectedModel = taskEnvModel.trim();
      reason = `Task-specific environment override configured (${taskUpper}_MODEL)`;
    } else {
      // 2. Resolve default routing based on task criticality
      if (isCognitive) {
        // Cognitively important tasks: explicit task model -> EDUIA_PRIMARY_MODEL -> explicit configuration error
        if (strategicPrimary) {
          selectedModel = strategicPrimary;
          const isAstra = isAstraModel(strategicPrimary);
          reason = isAstra
            ? "Strategic Astra-first model selected (EDUIA_PRIMARY_MODEL)"
            : "Strategic primary model selected (EDUIA_PRIMARY_MODEL)";
        } else {
          throw new Error(
            `Model not configured for task: ${context.task} (cognitively important task requires explicit task override or EDUIA_PRIMARY_MODEL)`
          );
        }
      } else {
        // Low-risk tasks: explicit task model -> policy-approved cheaper model -> EDUIA_PRIMARY_MODEL
        if (normalizedTask === "classifier") {
          const approvedCheap =
            process.env.POLICY_APPROVED_CLASSIFIER_MODEL?.trim() || process.env.LOW_RISK_MODEL?.trim();
          if (approvedCheap) {
            selectedModel = approvedCheap;
            reason = "Policy-approved low-risk model selected for classifier";
          }
        } else if (normalizedTask === "material") {
          const approvedCheap = process.env.POLICY_APPROVED_MATERIAL_MODEL?.trim();
          if (approvedCheap) {
            selectedModel = approvedCheap;
            reason = "Policy-approved low-risk model selected for material";
          }
        }

        if (!selectedModel) {
          if (strategicPrimary) {
            selectedModel = strategicPrimary;
            const isAstra = isAstraModel(strategicPrimary);
            reason = isAstra
              ? "Resolved from EDUIA_PRIMARY_MODEL (Astra primary)"
              : "Resolved from EDUIA_PRIMARY_MODEL configuration";
          } else {
            throw new Error(
              `Model not configured for task: ${context.task} (no task-specific override and no EDUIA_PRIMARY_MODEL specified)`
            );
          }
        }
      }
    }

    if (!selectedModel || selectedModel === "") {
      throw new Error(`Model not configured for task: ${context.task}`);
    }

    // 3. Resolve operational fallback model if configured
    const configuredFallback = process.env.FALLBACK_MODEL?.trim();
    let fallbackModel: string | undefined;
    if (configuredFallback && configuredFallback !== "" && configuredFallback !== selectedModel) {
      fallbackModel = configuredFallback;
    } else if (process.env.ENABLE_OPERATIONAL_FALLBACK === "true" && selectedModel !== "openai/gpt-4o-mini") {
      fallbackModel = "openai/gpt-4o-mini";
    }

    // 4. Look up capabilities and provider
    const metadata = getModelMetadata(selectedModel);
    const resolvedPrimary = strategicPrimary || selectedModel;
    const isStrategicPrimary =
      isAstraModel(selectedModel) ||
      (selectedModel === strategicPrimary && strategicPrimary !== "openai/gpt-4o-mini");

    return {
      model: selectedModel,
      provider: metadata.provider,
      reason,
      policyVersion: this.policyVersion,
      primaryModel: resolvedPrimary,
      isStrategicPrimary,
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
      message.includes("timed out") ||
      message.includes("etimedout") ||
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
