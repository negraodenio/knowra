/**
 * AI Gateway Operational Configuration (§28, §29)
 * Safely parses operational settings with strict type conversion.
 * Model IDs themselves are NOT given arbitrary defaults and live in the model registry.
 */

export interface AIConfig {
  provider: string;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
}

export function getAIConfig(): AIConfig {
  const provider = process.env.AI_PROVIDER || "openrouter";

  const rawTemp = process.env.AI_TEMPERATURE;
  const parsedTemp = rawTemp !== undefined && rawTemp.trim() !== "" ? Number(rawTemp) : NaN;
  const temperature = !isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2 ? parsedTemp : 0.2;

  const rawRetries = process.env.AI_MAX_RETRIES;
  const parsedRetries = rawRetries !== undefined && rawRetries.trim() !== "" ? parseInt(rawRetries, 10) : NaN;
  const maxRetries = !isNaN(parsedRetries) && parsedRetries >= 0 ? parsedRetries : 2;

  const rawTimeout = process.env.AI_TIMEOUT_MS;
  const parsedTimeout = rawTimeout !== undefined && rawTimeout.trim() !== "" ? parseInt(rawTimeout, 10) : NaN;
  const timeoutMs = !isNaN(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 30000;

  return {
    provider,
    temperature,
    maxRetries,
    timeoutMs,
  };
}
