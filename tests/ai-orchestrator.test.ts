import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { aiModelOrchestrator } from "@/lib/ai/orchestrator";
import { getModelMetadata, KNOWN_MODEL_CATALOG } from "@/lib/ai/capabilities";
import { aiGateway } from "@/lib/ai/gateway";
import { openRouterClient } from "@/lib/ai/openrouter";
import { telemetryService } from "@/lib/ai/usage";
import { benchmarkModel, compareModels } from "@/lib/ai/evaluation";

describe("S7.5 — AI Model Orchestrator & Selection Layer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    telemetryService.clearUsageRecords();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ------------------------------------------------------------
  // 1. DEFAULT MODEL & TASK-SPECIFIC SELECTION (§S7.5)
  // ------------------------------------------------------------
  describe("Model Selection & Default Strategy", () => {
    it("selects task-specific override when both task model and DEFAULT_MODEL exist", () => {
      process.env.DEFAULT_MODEL = "provider/default-model";
      process.env.TUTOR_MODEL = "anthropic/claude-3.5-sonnet-custom";

      const decision = aiModelOrchestrator.selectModel({ task: "tutor" });
      expect(decision.model).toBe("anthropic/claude-3.5-sonnet-custom");
      expect(decision.reason).toContain("Task-specific environment override");
      expect(decision.policyVersion).toBe("EDUIA_POLICY_V1");
    });

    it("falls back to DEFAULT_MODEL when task-specific model is unconfigured", () => {
      delete process.env.DIAGNOSTIC_MODEL;
      process.env.DEFAULT_MODEL = "provider/platform-default";

      const decision = aiModelOrchestrator.selectModel({ task: "diagnostic" });
      expect(decision.model).toBe("provider/platform-default");
      expect(decision.reason).toContain("DEFAULT_MODEL");
    });

    it("fails explicitly when both task model and DEFAULT_MODEL are missing", () => {
      delete process.env.FEYNMAN_MODEL;
      delete process.env.DEFAULT_MODEL;

      expect(() => {
        aiModelOrchestrator.selectModel({ task: "feynman" });
      }).toThrowError(/Model not configured for task: feynman/);
    });

    it("does NEVER silently invent or guess a random model", () => {
      delete process.env.ASSESSMENT_MODEL;
      delete process.env.DEFAULT_MODEL;

      expect(() => {
        aiModelOrchestrator.selectModel({ task: "assessment" });
      }).toThrow();
    });

    it("correctly identifies and flags Astra candidate when configured as DEFAULT_MODEL", () => {
      delete process.env.MATERIAL_MODEL;
      process.env.DEFAULT_MODEL = "astra/astra-pro-v1";

      const decision = aiModelOrchestrator.selectModel({ task: "material" });
      expect(decision.model).toBe("astra/astra-pro-v1");
      expect(decision.reason).toContain("Astra default candidate");
      const metadata = getModelMetadata(decision.model);
      expect(metadata.isAstraCandidate).toBe(true);
    });
  });

  // ------------------------------------------------------------
  // 2. MODEL CAPABILITY & METADATA LOOKUP (§S7.5)
  // ------------------------------------------------------------
  describe("Capabilities & Metadata Registry", () => {
    it("looks up exact capabilities and pricing for known models", () => {
      const gpt4oMini = getModelMetadata("openai/gpt-4o-mini");
      expect(gpt4oMini.capabilities).toContain("TEXT_GENERATION");
      expect(gpt4oMini.capabilities).toContain("LOW_COST");
      expect(gpt4oMini.speedTier).toBe("FAST");
      expect(gpt4oMini.inputPricePerMillion).toBe(0.15);

      const claude = getModelMetadata("anthropic/claude-3.5-sonnet");
      expect(claude.capabilities).toContain("REASONING");
      expect(claude.capabilities).toContain("LONG_CONTEXT");
      expect(claude.qualityTier).toBe("HIGH");
      expect(claude.contextLimit).toBe(200000);
    });

    it("provides safe defaults for dynamically configured external models", () => {
      const customModel = getModelMetadata("meta/llama-3.3-70b-instruct");
      expect(customModel.provider).toBe("meta");
      expect(customModel.contextLimit).toBe(128000);
      expect(customModel.capabilities).toContain("TEXT_GENERATION");
    });
  });

  // ------------------------------------------------------------
  // 3. OPERATIONAL FALLBACK HANDLING (§S7.5)
  // ------------------------------------------------------------
  describe("Operational Fallback Routing", () => {
    it("falls back to secondary model on operational network/timeout/5xx failure", async () => {
      process.env.TUTOR_MODEL = "primary/failing-model";
      process.env.FALLBACK_MODEL = "fallback/reliable-model";

      // First call (primary) fails with 500 error; second call (fallback) succeeds
      const completeSpy = vi.spyOn(openRouterClient, "complete")
        .mockRejectedValueOnce(new Error("OpenRouter HTTP error (502 Bad Gateway)"))
        .mockResolvedValueOnce({
          content: "Successful tutoring answer from fallback",
          model: "fallback/reliable-model",
          promptTokens: 20,
          completionTokens: 10,
        });

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "System",
        userPrompt: "Explain loops",
        promptVersion: "TUTOR_V1",
      });

      expect(completeSpy).toHaveBeenCalledTimes(2);
      expect(result.model).toBe("fallback/reliable-model");
      expect(result.data).toBe("Successful tutoring answer from fallback");
      expect(result.usage.fallbackUsed).toBe(true);
      expect(result.usage.fallbackModel).toBe("fallback/reliable-model");
    });

    it("does NOT fallback on Zod schema validation errors (business failure)", async () => {
      process.env.CLASSIFIER_MODEL = "primary/valid-endpoint";
      process.env.FALLBACK_MODEL = "fallback/backup-endpoint";

      const TargetSchema = z.object({
        status: z.enum(["PASS", "FAIL"]),
      });

      // Primary returns invalid schema (numeric instead of string enum)
      const completeSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValue({
        content: JSON.stringify({ status: 12345 }),
        model: "primary/valid-endpoint",
        promptTokens: 15,
        completionTokens: 5,
      });

      await expect(
        aiGateway.generateStructured({
          task: "classifier",
          systemPrompt: "System",
          userPrompt: "Check",
          promptVersion: "TEST_V1",
          schema: TargetSchema,
        })
      ).rejects.toThrow(/AI output failed schema validation/);

      // Crucial: Fallback was NOT triggered because failure is validation-based
      expect(completeSpy).toHaveBeenCalledTimes(1);
    });

    it("correctly identifies operational errors vs validation errors", () => {
      expect(aiModelOrchestrator.isOperationalError(new Error("Timeout of 30000ms exceeded"))).toBe(true);
      expect(aiModelOrchestrator.isOperationalError(new Error("404 No endpoints found"))).toBe(true);
      expect(aiModelOrchestrator.isOperationalError(new Error("429 Rate limit reached"))).toBe(true);
      expect(aiModelOrchestrator.isOperationalError(new Error("503 Service Unavailable"))).toBe(true);
      expect(aiModelOrchestrator.isOperationalError(new Error("fetch failed: ECONNREFUSED"))).toBe(true);

      // Validation/Parse errors are NOT operational
      expect(aiModelOrchestrator.isOperationalError(new Error("Zod validation error: Invalid enum"))).toBe(false);
      expect(aiModelOrchestrator.isOperationalError(new Error("Failed to parse AI output as JSON"))).toBe(false);
    });
  });

  // ------------------------------------------------------------
  // 4. TELEMETRY & OBSERVABILITY AGGREGATION (§S7.5)
  // ------------------------------------------------------------
  describe("Telemetry & Observability", () => {
    it("records orchestration policy and selection reason in usage records", async () => {
      process.env.CLASSIFIER_MODEL = "openai/gpt-4o-mini";

      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "OK",
        model: "openai/gpt-4o-mini",
        promptTokens: 10,
        completionTokens: 2,
      });

      const res = await aiGateway.generateText({
        task: "classifier",
        systemPrompt: "System",
        userPrompt: "Classify",
        promptVersion: "CLASSIFIER_V1",
      });

      expect(res.usage.orchestrationPolicy).toBe("EDUIA_POLICY_V1");
      expect(res.usage.selectionReason).toContain("CLASSIFIER_MODEL");
      expect(res.usage.fallbackUsed).toBe(false);
    });

    it("aggregates model observability statistics accurately", async () => {
      process.env.CLASSIFIER_MODEL = "openai/gpt-4o-mini";

      vi.spyOn(openRouterClient, "complete")
        .mockResolvedValueOnce({
          content: "Resp 1",
          model: "openai/gpt-4o-mini",
          promptTokens: 50,
          completionTokens: 10,
        })
        .mockResolvedValueOnce({
          content: "Resp 2",
          model: "openai/gpt-4o-mini",
          promptTokens: 60,
          completionTokens: 20,
        });

      await aiGateway.generateText({
        task: "classifier",
        systemPrompt: "System",
        userPrompt: "Prompt 1",
        promptVersion: "V1",
      });

      await aiGateway.generateText({
        task: "classifier",
        systemPrompt: "System",
        userPrompt: "Prompt 2",
        promptVersion: "V1",
      });

      const stats = telemetryService.getModelObservabilityStats();
      const classifierStats = stats["openai/gpt-4o-mini:classifier"];

      expect(classifierStats).toBeDefined();
      expect(classifierStats.callCount).toBe(2);
      expect(classifierStats.successCount).toBe(2);
      expect(classifierStats.failureCount).toBe(0);
      expect(classifierStats.totalTokens).toBe(140);
    });
  });

  // ------------------------------------------------------------
  // 5. LIGHTWEIGHT MODEL BENCHMARKING (§S7.5)
  // ------------------------------------------------------------
  describe("Model Evaluation & Comparison Harness", () => {
    it("benchmarks single model performance", async () => {
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Benchmark answer",
        model: "openai/gpt-4o-mini",
        promptTokens: 30,
        completionTokens: 10,
      });

      const result = await benchmarkModel("openai/gpt-4o-mini", {
        task: "tutor",
        testPrompt: "Explain recursion in 2 sentences.",
      });

      expect(result.success).toBe(true);
      expect(result.schemaValid).toBe(true);
      expect(result.model).toBe("openai/gpt-4o-mini");
      expect(result.totalTokens).toBe(40);
    });

    it("compares candidate models and produces comparison report", async () => {
      vi.spyOn(openRouterClient, "complete")
        .mockResolvedValueOnce({
          content: "Answer A",
          model: "model-a",
          promptTokens: 20,
          completionTokens: 5,
        })
        .mockResolvedValueOnce({
          content: "Answer B",
          model: "model-b",
          promptTokens: 20,
          completionTokens: 5,
        });

      const report = await compareModels(["model-a", "model-b"], {
        task: "classifier",
        testPrompt: "Classify this sample",
      });

      expect(report.benchmarks.length).toBe(2);
      expect(report.recommendedModel).toBeDefined();
      expect(report.reason).toContain("latency");
    });
  });
});
