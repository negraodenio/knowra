/**
 * Model Capability & Metadata Registry (§S7.5)
 * Defines capabilities, quality tiers, latency characteristics, and pricing metadata.
 * Allows the AI Model Orchestrator to make routing and evaluation decisions.
 */

export type ModelCapability =
  | "TEXT_GENERATION"
  | "STRUCTURED_OUTPUT"
  | "REASONING"
  | "LONG_CONTEXT"
  | "LOW_LATENCY"
  | "LOW_COST";

export type QualityTier = "LOW" | "MEDIUM" | "HIGH";
export type SpeedTier = "FAST" | "MEDIUM" | "SLOW";

export interface ModelMetadata {
  id: string;
  provider: string;
  displayName: string;
  capabilities: ModelCapability[];
  contextLimit: number;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  qualityTier: QualityTier;
  speedTier: SpeedTier;
  isAstraCandidate?: boolean;
}

/**
 * Known model catalog for capability and cost inspection.
 * Extensible to future models without changing the learning engine.
 */
export const KNOWN_MODEL_CATALOG: Record<string, ModelMetadata> = {
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o Mini",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "LOW_LATENCY", "LOW_COST"],
    contextLimit: 128000,
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    qualityTier: "MEDIUM",
    speedTier: "FAST",
  },
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "REASONING", "LONG_CONTEXT"],
    contextLimit: 128000,
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    qualityTier: "HIGH",
    speedTier: "MEDIUM",
  },
  "anthropic/claude-3.5-sonnet": {
    id: "anthropic/claude-3.5-sonnet",
    provider: "anthropic",
    displayName: "Claude 3.5 Sonnet",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "REASONING", "LONG_CONTEXT"],
    contextLimit: 200000,
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    qualityTier: "HIGH",
    speedTier: "MEDIUM",
  },
  "deepseek/deepseek-chat": {
    id: "deepseek/deepseek-chat",
    provider: "deepseek",
    displayName: "DeepSeek Chat",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "REASONING", "LOW_COST"],
    contextLimit: 64000,
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    qualityTier: "HIGH",
    speedTier: "MEDIUM",
  },
  "openai/gpt-6-astra": {
    id: "openai/gpt-6-astra",
    provider: "openai",
    displayName: "GPT-6 Astra (OpenAI candidate)",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "REASONING", "LONG_CONTEXT"],
    contextLimit: 1050000,
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 50.0,
    qualityTier: "HIGH",
    speedTier: "SLOW",
    isAstraCandidate: true,
  },
  "~openai/gpt-astra-latest": {
    id: "~openai/gpt-astra-latest",
    provider: "openai",
    displayName: "GPT Astra Latest",
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT", "REASONING", "LONG_CONTEXT"],
    contextLimit: 1050000,
    inputPricePerMillion: 10.0,
    outputPricePerMillion: 50.0,
    qualityTier: "HIGH",
    speedTier: "SLOW",
    isAstraCandidate: true,
  },
};

/**
 * Resolves metadata for any model identifier.
 * Provides sensible defaults for dynamically configured or custom models.
 */
export function getModelMetadata(modelId: string): ModelMetadata {
  if (KNOWN_MODEL_CATALOG[modelId]) {
    return KNOWN_MODEL_CATALOG[modelId];
  }

  // Provider extraction from model ID format "provider/model-name"
  const provider = modelId.includes("/") ? modelId.split("/")[0] : "unknown";

  return {
    id: modelId,
    provider,
    displayName: modelId,
    capabilities: ["TEXT_GENERATION", "STRUCTURED_OUTPUT"],
    contextLimit: 128000,
    inputPricePerMillion: 1.0,
    outputPricePerMillion: 3.0,
    qualityTier: "HIGH",
    speedTier: "MEDIUM",
    isAstraCandidate: modelId.toLowerCase().includes("astra"),
  };
}
