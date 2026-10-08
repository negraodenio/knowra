import { z } from "zod";
import { aiGateway } from "./gateway";
import { ModelTask } from "./models";

export interface ModelBenchmarkContext {
  task: ModelTask;
  testPrompt: string;
  systemPrompt?: string;
  schema?: z.ZodTypeAny;
  expectedOutputSubstring?: string;
}

export interface ModelBenchmarkResult {
  model: string;
  task: ModelTask;
  success: boolean;
  schemaValid: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errorMessage?: string;
}

export interface ModelComparisonReport {
  task: ModelTask;
  timestamp: string;
  benchmarks: ModelBenchmarkResult[];
  recommendedModel: string;
  reason: string;
}

/**
 * Lightweight Model Evaluation Harness (§S7.5).
 * Enables empirical performance comparison between models (Astra, Claude, DeepSeek, GPT)
 * without building a heavy experimentation platform.
 */
export async function benchmarkModel(
  modelId: string,
  context: ModelBenchmarkContext
): Promise<ModelBenchmarkResult> {
  const startTime = Date.now();
  try {
    if (context.schema) {
      const res = await aiGateway.generateStructured({
        task: context.task,
        modelOverride: modelId,
        systemPrompt: context.systemPrompt || "You are an educational assistant.",
        userPrompt: context.testPrompt,
        schema: context.schema,
        promptVersion: "BENCHMARK_V1",
      });

      const latencyMs = Date.now() - startTime;
      return {
        model: modelId,
        task: context.task,
        success: true,
        schemaValid: true,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
      };
    } else {
      const res = await aiGateway.generateText({
        task: context.task,
        modelOverride: modelId,
        systemPrompt: context.systemPrompt || "You are an educational assistant.",
        userPrompt: context.testPrompt,
        promptVersion: "BENCHMARK_V1",
      });

      const latencyMs = Date.now() - startTime;
      return {
        model: modelId,
        task: context.task,
        success: true,
        schemaValid: true,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    return {
      model: modelId,
      task: context.task,
      success: false,
      schemaValid: false,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Compares candidate models for a pedagogical task and produces a structured comparison report.
 */
export async function compareModels(
  modelIds: string[],
  context: ModelBenchmarkContext
): Promise<ModelComparisonReport> {
  const benchmarks: ModelBenchmarkResult[] = [];

  for (const model of modelIds) {
    const result = await benchmarkModel(model, context);
    benchmarks.push(result);
  }

  // Sort by success first, then latency and cost
  const successful = benchmarks.filter((b) => b.success);
  let recommendedModel = modelIds[0] || "unknown";
  let reason = "No models succeeded in benchmark";

  if (successful.length > 0) {
    // Recommend fastest successful model with lowest error
    successful.sort((a, b) => a.latencyMs - b.latencyMs);
    recommendedModel = successful[0].model;
    reason = `Lowest latency (${successful[0].latencyMs}ms) among successful candidates`;
  }

  return {
    task: context.task,
    timestamp: new Date().toISOString(),
    benchmarks,
    recommendedModel,
    reason,
  };
}
