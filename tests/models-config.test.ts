import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getModel,
  getModelForTask,
  calculateEstimatedCost,
  validateModelConfig,
  getAIConfig,
} from "@/lib/ai/models";
import { aiGateway } from "@/lib/ai/gateway";
import { openRouterClient } from "@/lib/ai/openrouter";

describe("Model Strategy & Task-Specific Model Registry (§28, §29)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.ENABLE_AI_CACHE = "false";
    delete process.env.EDUIA_PRIMARY_MODEL;
    delete process.env.DEFAULT_MODEL;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("Task Registry Resolution", () => {
    it("resolves all 8 environment-driven tasks correctly", () => {
      process.env.TUTOR_MODEL = "test/tutor-model";
      process.env.FEYNMAN_MODEL = "test/feynman-model";
      process.env.CLASSIFIER_MODEL = "test/classifier-model";
      process.env.DIAGNOSTIC_MODEL = "test/diagnostic-model";
      process.env.PLAN_MODEL = "test/plan-model";
      process.env.COMPETENCY_MODEL = "test/competency-model";
      process.env.ASSESSMENT_MODEL = "test/assessment-model";
      process.env.MATERIAL_MODEL = "test/material-model";

      expect(getModel("tutor")).toBe("test/tutor-model");
      expect(getModel("feynman")).toBe("test/feynman-model");
      expect(getModel("classifier")).toBe("test/classifier-model");
      expect(getModel("diagnostic")).toBe("test/diagnostic-model");
      expect(getModel("plan")).toBe("test/plan-model");
      expect(getModel("competency")).toBe("test/competency-model");
      expect(getModel("assessment")).toBe("test/assessment-model");
      expect(getModel("material")).toBe("test/material-model");
    });

    it("fails clearly when environment variable is missing without silent fallback", () => {
      delete process.env.FEYNMAN_MODEL;
      expect(() => getModel("feynman")).toThrowError("Model not configured for task: feynman");

      delete process.env.TUTOR_MODEL;
      expect(() => getModel("tutor")).toThrowError("Model not configured for task: tutor");

      delete process.env.DIAGNOSTIC_MODEL;
      expect(() => getModel("diagnostic")).toThrowError("Model not configured for task: diagnostic");
    });

    it("validates full configuration via validateModelConfig", () => {
      process.env.TUTOR_MODEL = "test/tutor";
      process.env.FEYNMAN_MODEL = "test/feynman";
      expect(() => validateModelConfig(["tutor", "feynman"])).not.toThrow();

      delete process.env.FEYNMAN_MODEL;
      expect(() => validateModelConfig(["tutor", "feynman"])).toThrowError(
        "Model not configured for task: feynman"
      );
    });
  });

  describe("Gateway & OpenRouter Layer Propagation", () => {
    it("passes the environment-resolved model ID to the OpenRouter client", async () => {
      process.env.CLASSIFIER_MODEL = "openai/gpt-4o-mini-custom";

      const spy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "test classification",
        model: "openai/gpt-4o-mini-custom",
        promptTokens: 10,
        completionTokens: 5,
      });

      const result = await aiGateway.generateText({
        task: "classifier",
        systemPrompt: "System",
        userPrompt: "Classify",
        promptVersion: "CLASSIFIER_V1",
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "openai/gpt-4o-mini-custom",
        })
      );
      expect(result.model).toBe("openai/gpt-4o-mini-custom");
    });

    it("convenience method generate passes correct task-resolved model", async () => {
      process.env.TUTOR_MODEL = "anthropic/claude-3.5-sonnet-custom";

      const spy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "tutoring response",
        model: "anthropic/claude-3.5-sonnet-custom",
        promptTokens: 15,
        completionTokens: 20,
      });

      const result = await aiGateway.generate("tutor", "Explain variable scope");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-3.5-sonnet-custom",
        })
      );
      expect(result.data).toBe("tutoring response");
    });
  });

  describe("Operational Configuration Parsing", () => {
    it("parses valid operational numbers safely", () => {
      process.env.AI_PROVIDER = "openrouter";
      process.env.AI_TEMPERATURE = "0.7";
      process.env.AI_MAX_RETRIES = "3";
      process.env.AI_TIMEOUT_MS = "45000";

      const config = getAIConfig();
      expect(config.provider).toBe("openrouter");
      expect(config.temperature).toBe(0.7);
      expect(config.maxRetries).toBe(3);
      expect(config.timeoutMs).toBe(45000);
    });

    it("falls back safely on invalid operational configuration without breaking", () => {
      delete process.env.AI_PROVIDER;
      process.env.AI_TEMPERATURE = "invalid-temp";
      process.env.AI_MAX_RETRIES = "not-a-number";
      process.env.AI_TIMEOUT_MS = "-10";

      const config = getAIConfig();
      expect(config.provider).toBe("openrouter");
      expect(config.temperature).toBe(0.2);
      expect(config.maxRetries).toBe(2);
      expect(config.timeoutMs).toBe(30000);
    });
  });

  describe("Legacy Compatibility & Pricing", () => {
    it("resolves default models when environment variables are not set (legacy getModelForTask)", () => {
      delete process.env.TUTOR_MODEL;
      delete process.env.CLASSIFIER_MODEL;
      delete process.env.ASSESSMENT_MODEL;

      expect(getModelForTask("TUTOR")).toBe("anthropic/claude-3.5-sonnet");
      expect(getModelForTask("CLASSIFIER")).toBe("openai/gpt-4o-mini");
      expect(getModelForTask("ASSESSMENT")).toBe("openai/gpt-4o");
    });

    it("allows environment variable override per task (§29) (legacy getModelForTask)", () => {
      process.env.TUTOR_MODEL = "deepseek/deepseek-chat";
      process.env.CLASSIFIER_MODEL = "custom/classifier-v2";

      expect(getModelForTask("TUTOR")).toBe("deepseek/deepseek-chat");
      expect(getModelForTask("CLASSIFIER")).toBe("custom/classifier-v2");
    });

    it("calculates estimated token costs correctly based on model pricing (§30)", () => {
      const cost = calculateEstimatedCost("openai/gpt-4o-mini", 1000, 500);
      expect(cost).toBeCloseTo(0.00045, 5);
    });
  });
});
