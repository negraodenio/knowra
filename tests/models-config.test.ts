import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getModelForTask, calculateEstimatedCost } from "@/lib/ai/models";

describe("Model Strategy & Task Resolver", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("resolves default models when environment variables are not set", () => {
    delete process.env.TUTOR_MODEL;
    delete process.env.CLASSIFIER_MODEL;
    delete process.env.ASSESSMENT_MODEL;

    expect(getModelForTask("TUTOR")).toBe("anthropic/claude-3.5-sonnet");
    expect(getModelForTask("CLASSIFIER")).toBe("openai/gpt-4o-mini");
    expect(getModelForTask("ASSESSMENT")).toBe("openai/gpt-4o");
  });

  it("allows environment variable override per task (§29)", () => {
    process.env.TUTOR_MODEL = "deepseek/deepseek-chat";
    process.env.CLASSIFIER_MODEL = "custom/classifier-v2";

    expect(getModelForTask("TUTOR")).toBe("deepseek/deepseek-chat");
    expect(getModelForTask("CLASSIFIER")).toBe("custom/classifier-v2");
  });

  it("calculates estimated token costs correctly based on model pricing (§30)", () => {
    // openai/gpt-4o-mini: $0.15/M prompt, $0.60/M completion
    const cost = calculateEstimatedCost("openai/gpt-4o-mini", 1000, 500);
    // (1000/1000000 * 0.15) + (500/1000000 * 0.60) = 0.00015 + 0.00030 = 0.00045
    expect(cost).toBeCloseTo(0.00045, 5);
  });
});
