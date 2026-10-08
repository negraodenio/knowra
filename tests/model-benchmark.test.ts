import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { openRouterClient } from "@/lib/ai/openrouter";
import { telemetryService } from "@/lib/ai/usage";
import { aiGateway } from "@/lib/ai/gateway";
import { aiModelOrchestrator } from "@/lib/ai/orchestrator";
import { models, ModelTask } from "@/lib/ai/models";
import {
  benchmarkModel,
  compareModels,
  executeEduiaBenchmarkTask,
  runEduiaBenchmarkSuite,
  verifyAstraStatus,
  verifyModelStatus,
  classifyError,
  aggregateBenchmarkRuns,
  generateBenchmarkRecommendation,
  EDUIABENCHMARK_TASKS,
  BenchmarkResult,
  BENCHMARK_VERSION,
} from "@/lib/ai/evaluation";

describe("S7.6 — Model Benchmark & Astra Validation Suite", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ==========================================================================
  // 1. BENCHMARK MODEL SELECTION
  // ==========================================================================
  describe("1. Benchmark Model Selection", () => {
    it("selects candidate model via modelOverride without altering default routing", async () => {
      const completeSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({
          category: "SETUP_ENVIRONMENT",
          confidence: 0.95,
        }),
        model: "candidate-model-v1",
        promptTokens: 25,
        completionTokens: 15,
      });

      const result = await executeEduiaBenchmarkTask("candidate-model-v1", "classifier", 1);

      expect(completeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "candidate-model-v1",
        })
      );
      expect(result.model).toBe("candidate-model-v1");
      expect(result.task).toBe("classifier");
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 2. VERIFIED MODEL HANDLING
  // ==========================================================================
  describe("2. Verified Model Handling", () => {
    it("correctly identifies verified models", () => {
      const gpt4oMini = verifyModelStatus("openai/gpt-4o-mini");
      expect(gpt4oMini.verificationStatus).toBe("VERIFIED");
      expect(gpt4oMini.provider).toBe("openai");

      const gpt4o = verifyModelStatus("openai/gpt-4o");
      expect(gpt4o.verificationStatus).toBe("VERIFIED");

      const deepseek = verifyModelStatus("deepseek/deepseek-chat");
      expect(deepseek.verificationStatus).toBe("VERIFIED");
    });

    it("identifies unavailable/blocked model endpoints", () => {
      const claude = verifyModelStatus("anthropic/claude-3.5-sonnet");
      expect(claude.verificationStatus).toBe("BLOCKED");
      expect(claude.reason).toContain("404");
    });
  });

  // ==========================================================================
  // 3. UNVERIFIED ASTRA HANDLING
  // ==========================================================================
  describe("3. Unverified Astra Handling", () => {
    it("reports Astra as BLOCKED when DEFAULT_MODEL is unset", () => {
      delete process.env.DEFAULT_MODEL;
      const status = verifyAstraStatus();

      expect(status.verified).toBe(false);
      expect(status.status).toBe("BLOCKED");
      expect(status.reason).toContain("DEFAULT_MODEL is empty");
      expect(status.modelId).toBeUndefined();
    });

    it("never fabricates an arbitrary Astra ID when unconfigured", () => {
      process.env.DEFAULT_MODEL = "";
      const status = verifyAstraStatus();
      expect(status.verified).toBe(false);
      expect(status.status).toBe("BLOCKED");

      const checkCandidate = verifyModelStatus("astra/hypothetical-model");
      expect(checkCandidate.verificationStatus).toBe("BLOCKED");
    });

    it("verifies Astra when explicitly configured with an exact ID", () => {
      process.env.DEFAULT_MODEL = "openai/gpt-6-astra";
      const status = verifyAstraStatus();

      expect(status.verified).toBe(true);
      expect(status.status).toBe("VERIFIED");
      expect(status.modelId).toBe("openai/gpt-6-astra");
    });

    it("recommends VALIDATION_BLOCKED for Astra when unverified", () => {
      const status = verifyAstraStatus();
      const rec = generateBenchmarkRecommendation([], status);

      expect(rec.astraRecommendation).toBe("D) VALIDATION_BLOCKED");
    });
  });

  // ==========================================================================
  // 4. DETERMINISTIC BENCHMARK RESULT STRUCTURE
  // ==========================================================================
  describe("4. Deterministic Benchmark Result Structure", () => {
    it("produces complete, auditable BenchmarkResult structure", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({
          category: "SETUP_ENVIRONMENT",
          confidence: 0.99,
        }),
        model: "openai/gpt-4o-mini",
        promptTokens: 40,
        completionTokens: 20,
      });

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res).toHaveProperty("model", "openai/gpt-4o-mini");
      expect(res).toHaveProperty("task", "classifier");
      expect(res).toHaveProperty("runNumber", 1);
      expect(res).toHaveProperty("qualityScore", 100);
      expect(res).toHaveProperty("schemaValid", true);
      expect(res).toHaveProperty("latencyMs");
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);
      expect(res).toHaveProperty("promptTokens", 40);
      expect(res).toHaveProperty("completionTokens", 20);
      expect(res).toHaveProperty("totalTokens", 60);
      expect(res).toHaveProperty("estimatedCost");
      expect(res).toHaveProperty("success", true);
      expect(res).toHaveProperty("failureType", "NONE");
      expect(res).toHaveProperty("evaluator", "deterministic-rubric-v1");
      expect(res).toHaveProperty("benchmarkVersion", BENCHMARK_VERSION);
      expect(res).toHaveProperty("timestamp");
    });
  });

  // ==========================================================================
  // 5. SCHEMA FAILURE CLASSIFICATION
  // ==========================================================================
  describe("5. Schema Failure Classification", () => {
    it("classifies JSON parsing errors as SCHEMA_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Not valid JSON at all: { broken json",
        model: "openai/gpt-4o-mini",
        promptTokens: 20,
        completionTokens: 10,
      });

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res.success).toBe(false);
      expect(res.schemaValid).toBe(false);
      expect(res.failureType).toBe("SCHEMA_FAILURE");
      expect(res.qualityScore).toBe(0);
      expect(res.failureReason).toContain("Failed to parse AI output as JSON");
    });

    it("classifies Zod schema validation errors as SCHEMA_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({
          category: "INVALID_UNKNOWN_CATEGORY",
          confidence: 2.5, // Exceeds 1.0 limit
        }),
        model: "openai/gpt-4o-mini",
        promptTokens: 20,
        completionTokens: 10,
      });

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res.success).toBe(false);
      expect(res.schemaValid).toBe(false);
      expect(res.failureType).toBe("SCHEMA_FAILURE");
      expect(res.failureReason).toContain("schema validation");
    });
  });

  // ==========================================================================
  // 6. OPERATIONAL FAILURE CLASSIFICATION
  // ==========================================================================
  describe("6. Operational Failure Classification", () => {
    it("classifies network timeout / fetch failed as OPERATIONAL_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockRejectedValueOnce(
        new Error("fetch failed: connection timeout after 30000ms")
      );

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res.success).toBe(false);
      expect(res.failureType).toBe("OPERATIONAL_FAILURE");
      expect(res.failureReason).toContain("timeout");
    });

    it("classifies 404 endpoint not found as OPERATIONAL_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockRejectedValueOnce(
        new Error("No endpoints found for anthropic/claude-3.5-sonnet (404)")
      );

      const res = await executeEduiaBenchmarkTask("anthropic/claude-3.5-sonnet", "classifier", 1);

      expect(res.success).toBe(false);
      expect(res.failureType).toBe("OPERATIONAL_FAILURE");
    });

    it("classifies 429 rate limit as OPERATIONAL_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockRejectedValueOnce(
        new Error("OpenRouter error (429): Rate limit exceeded")
      );

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res.success).toBe(false);
      expect(res.failureType).toBe("OPERATIONAL_FAILURE");
    });
  });

  // ==========================================================================
  // 7. CONTENT FAILURE CLASSIFICATION
  // ==========================================================================
  describe("7. Content Failure Classification", () => {
    it("classifies valid schema with wrong classification answer as CONTENT_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({
          category: "CONCEPTUAL_QUESTION", // Wrong: ground truth is SETUP_ENVIRONMENT
          confidence: 0.9,
        }),
        model: "openai/gpt-4o-mini",
        promptTokens: 30,
        completionTokens: 10,
      });

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(res.schemaValid).toBe(true); // Schema is valid
      expect(res.success).toBe(false); // But content is incorrect
      expect(res.failureType).toBe("CONTENT_FAILURE");
      expect(res.qualityScore).toBe(0);
      expect(res.failureReason).toContain("misclassified");
    });

    it("classifies tutor output missing code example or check question as CONTENT_FAILURE", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Variables are nice in Python. They store things. The end.", // No code example, no misconception, no check question
        model: "openai/gpt-4o-mini",
        promptTokens: 40,
        completionTokens: 15,
      });

      const res = await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "tutor", 1);

      expect(res.schemaValid).toBe(true);
      expect(res.success).toBe(false);
      expect(res.failureType).toBe("CONTENT_FAILURE");
      expect(res.qualityScore).toBeLessThan(50);
    });
  });

  // ==========================================================================
  // 8. TELEMETRY CAPTURE
  // ==========================================================================
  describe("8. Telemetry Capture", () => {
    it("records AI usage telemetry on benchmark execution", async () => {
      const telemetrySpy = vi.spyOn(telemetryService, "recordUsage");

      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({
          category: "SETUP_ENVIRONMENT",
          confidence: 0.95,
        }),
        model: "openai/gpt-4o-mini",
        promptTokens: 35,
        completionTokens: 12,
      });

      await executeEduiaBenchmarkTask("openai/gpt-4o-mini", "classifier", 1);

      expect(telemetrySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "generateStructured:classifier",
          model: "openai/gpt-4o-mini",
          task: "classifier",
          promptTokens: 35,
          completionTokens: 12,
          status: "SUCCESS",
        })
      );
    });
  });

  // ==========================================================================
  // 9. MULTIPLE RUNS & AGGREGATION
  // ==========================================================================
  describe("9. Multiple Runs & Aggregation", () => {
    it("aggregates multiple runs calculating averages, min/max latency and failure rates", () => {
      const mockResults: BenchmarkResult[] = [
        {
          model: "test-model",
          task: "classifier",
          runNumber: 1,
          qualityScore: 100,
          schemaValid: true,
          latencyMs: 500,
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          estimatedCost: 0.00001,
          success: true,
          failureType: "NONE",
          evaluator: "eval",
          benchmarkVersion: "v1",
          timestamp: new Date().toISOString(),
        },
        {
          model: "test-model",
          task: "classifier",
          runNumber: 2,
          qualityScore: 100,
          schemaValid: true,
          latencyMs: 700,
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          estimatedCost: 0.00001,
          success: true,
          failureType: "NONE",
          evaluator: "eval",
          benchmarkVersion: "v1",
          timestamp: new Date().toISOString(),
        },
        {
          model: "test-model",
          task: "classifier",
          runNumber: 3,
          qualityScore: 0,
          schemaValid: true,
          latencyMs: 600,
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          estimatedCost: 0.00001,
          success: false,
          failureType: "CONTENT_FAILURE",
          evaluator: "eval",
          benchmarkVersion: "v1",
          timestamp: new Date().toISOString(),
        },
      ];

      const summaries = aggregateBenchmarkRuns(mockResults);
      expect(summaries.length).toBe(1);

      const s = summaries[0];
      expect(s.runs).toBe(3);
      expect(s.successRate).toBe(0.67);
      expect(s.avgQualityScore).toBe(67);
      expect(s.avgLatencyMs).toBe(600);
      expect(s.minLatencyMs).toBe(500);
      expect(s.maxLatencyMs).toBe(700);
      expect(s.schemaValidityRate).toBe(1.0);
      expect(s.contentFailureRate).toBe(0.33);
      expect(s.operationalFailureRate).toBe(0.0);
    });
  });

  // ==========================================================================
  // 10. NO PRODUCTION CONFIGURATION MUTATION
  // ==========================================================================
  describe("10. No Production Configuration Mutation", () => {
    it("never mutates DEFAULT_MODEL or task overrides during benchmark execution", async () => {
      process.env.DEFAULT_MODEL = "baseline-default";
      process.env.TUTOR_MODEL = "baseline-tutor";
      process.env.CLASSIFIER_MODEL = "baseline-classifier";

      const originalDefaults = {
        DEFAULT_MODEL: process.env.DEFAULT_MODEL,
        TUTOR_MODEL: process.env.TUTOR_MODEL,
        CLASSIFIER_MODEL: process.env.CLASSIFIER_MODEL,
      };

      vi.spyOn(openRouterClient, "complete").mockResolvedValue({
        content: JSON.stringify({
          category: "SETUP_ENVIRONMENT",
          confidence: 0.99,
        }),
        model: "benchmark-override-model",
        promptTokens: 25,
        completionTokens: 10,
      });

      // Run benchmark with an override model
      await executeEduiaBenchmarkTask("benchmark-override-model", "classifier", 1);

      // Verify production env remained completely untouched
      expect(process.env.DEFAULT_MODEL).toBe(originalDefaults.DEFAULT_MODEL);
      expect(process.env.TUTOR_MODEL).toBe(originalDefaults.TUTOR_MODEL);
      expect(process.env.CLASSIFIER_MODEL).toBe(originalDefaults.CLASSIFIER_MODEL);
    });
  });

  // ==========================================================================
  // 11. COMPARISON ACROSS MODELS
  // ==========================================================================
  describe("11. Comparison Across Models", () => {
    it("compares multiple models and generates auditable recommendations", async () => {
      vi.spyOn(openRouterClient, "complete")
        .mockResolvedValueOnce({
          content: JSON.stringify({ category: "SETUP_ENVIRONMENT", confidence: 0.95 }),
          model: "fast-model",
          promptTokens: 20,
          completionTokens: 5,
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({ category: "SETUP_ENVIRONMENT", confidence: 0.95 }),
          model: "smart-model",
          promptTokens: 20,
          completionTokens: 5,
        });

      const report = await runEduiaBenchmarkSuite({
        models: ["fast-model", "smart-model"],
        tasks: ["classifier"],
        runsPerTask: 1,
      });

      expect(report.modelsTested).toEqual(["fast-model", "smart-model"]);
      expect(report.results.length).toBe(2);
      expect(report.taskSummaries.length).toBe(2);
      expect(report.recommendations.defaultModel).toBeDefined();
      expect(report.recommendations.taskOverrides.classifier).toBeDefined();
    });
  });

  // ==========================================================================
  // 12. EXISTING S7.5 ORCHESTRATOR REGRESSION
  // ==========================================================================
  describe("12. Existing S7.5 Orchestrator Regression", () => {
    it("preserves S7.5 model selection and operational fallback logic", () => {
      process.env.DEFAULT_MODEL = "openai/gpt-4o";
      delete process.env.TUTOR_MODEL;

      const decision = aiModelOrchestrator.selectModel({ task: "tutor" });
      expect(decision.model).toBe("openai/gpt-4o");
      expect(decision.reason).toContain("DEFAULT_MODEL");

      expect(aiModelOrchestrator.isOperationalError(new Error("fetch failed"))).toBe(true);
      expect(aiModelOrchestrator.isOperationalError(new Error("Zod validation error"))).toBe(false);
    });

    it("preserves backward-compatible benchmarkModel and compareModels API", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Recursion is when a function calls itself.",
        model: "openai/gpt-4o-mini",
        promptTokens: 15,
        completionTokens: 10,
      });

      const res = await benchmarkModel("openai/gpt-4o-mini", {
        task: "tutor",
        testPrompt: "Explain recursion.",
      });

      expect(res.success).toBe(true);
      expect(res.model).toBe("openai/gpt-4o-mini");
      expect(res.totalTokens).toBe(25);
    });
  });
});
