import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";
import { aiModelOrchestrator, ORCHESTRATION_POLICY_VERSION } from "@/lib/ai/orchestrator";
import { getPrimaryModel, getModel, isAstraModel, isCognitiveTask } from "@/lib/ai/models";
import { aiGateway } from "@/lib/ai/gateway";
import { openRouterClient } from "@/lib/ai/openrouter";
import { telemetryService } from "@/lib/ai/usage";
import {
  verifyAstraStatus,
  verifyModelStatus,
  evaluatePedagogicalTask,
  executeEduiaBenchmarkTask,
} from "@/lib/ai/evaluation";

describe("S7.7 — Astra-First AI Orchestration & Pedagogical Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EDUIA_PRIMARY_MODEL;
    delete process.env.DEFAULT_MODEL;
    delete process.env.TUTOR_MODEL;
    delete process.env.FEYNMAN_MODEL;
    delete process.env.DIAGNOSTIC_MODEL;
    delete process.env.ASSESSMENT_MODEL;
    delete process.env.PLAN_MODEL;
    delete process.env.COMPETENCY_MODEL;
    delete process.env.MATERIAL_MODEL;
    delete process.env.CLASSIFIER_MODEL;
    telemetryService.clearUsageRecords();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // 1. Astra is the strategic primary model
  it("1. Astra is the strategic primary model for cognitive tasks", () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";
    process.env.FALLBACK_MODEL = "openai/gpt-4o-mini";

    const decision = aiModelOrchestrator.selectModel({ task: "tutor" });
    expect(decision.model).toBe("openai/gpt-6-astra");
    expect(decision.primaryModel).toBe("openai/gpt-6-astra");
    expect(decision.isStrategicPrimary).toBe(true);
    expect(decision.reason).toContain("Astra");
    expect(isAstraModel(decision.model)).toBe(true);
    expect(decision.fallbackModel).toBe("openai/gpt-4o-mini");
  });

  // 2. GPT-4o-mini cannot silently become strategic default
  it("2. GPT-4o-mini cannot silently become strategic default", () => {
    // If a legacy config set DEFAULT_MODEL to gpt-4o-mini, getPrimaryModel() rejects it
    process.env.DEFAULT_MODEL = "openai/gpt-4o-mini";
    delete process.env.EDUIA_PRIMARY_MODEL;

    expect(getPrimaryModel()).toBeUndefined();

    // Cognitive task without override MUST fail explicitly, NOT silently route to gpt-4o-mini
    expect(() => {
      aiModelOrchestrator.selectModel({ task: "tutor" });
    }).toThrowError(/cognitively important task requires explicit task override or EDUIA_PRIMARY_MODEL/);

    expect(() => {
      getModel("tutor");
    }).toThrowError(/Model not configured for task: tutor/);
  });

  // 3. Task override beats primary model
  it("3. Task override beats primary model", () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";
    process.env.TUTOR_MODEL = "anthropic/claude-3.5-sonnet-custom";

    const decision = aiModelOrchestrator.selectModel({ task: "tutor" });
    expect(decision.model).toBe("anthropic/claude-3.5-sonnet-custom");
    expect(decision.primaryModel).toBe("openai/gpt-6-astra");
    expect(decision.reason).toContain("Task-specific environment override configured (TUTOR_MODEL)");
  });

  // 4. Primary model is used when no task override exists
  it("4. Primary model is used when no task override exists for all cognitive tasks", () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";

    const cognitiveTasks = ["tutor", "feynman", "diagnostic", "assessment", "plan", "competency"];
    for (const t of cognitiveTasks) {
      expect(isCognitiveTask(t)).toBe(true);
      const decision = aiModelOrchestrator.selectModel({ task: t });
      expect(decision.model).toBe("openai/gpt-6-astra");
      expect(decision.isStrategicPrimary).toBe(true);
    }
  });

  // 5. Operational failure can trigger fallback
  it("5. Operational failure can trigger fallback to configured fallback model", async () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";
    process.env.FALLBACK_MODEL = "openai/gpt-4o-mini";
    process.env.ENABLE_OPERATIONAL_FALLBACK = "true";

    const completeSpy = vi.spyOn(openRouterClient, "complete")
      .mockRejectedValueOnce(new Error("502 Bad Gateway: Provider upstream failure"))
      .mockResolvedValueOnce({
        content: "Tutoring response from fallback model",
        model: "openai/gpt-4o-mini",
        promptTokens: 25,
        completionTokens: 15,
      });

    const result = await aiGateway.generateText({
      task: "tutor",
      systemPrompt: "You are a tutor",
      userPrompt: "Explain variables",
      promptVersion: "TUTOR_V1",
    });

    expect(completeSpy).toHaveBeenCalledTimes(2);
    expect(result.model).toBe("openai/gpt-4o-mini");
    expect(result.usage.fallbackUsed).toBe(true);
    expect(result.usage.fallbackModel).toBe("openai/gpt-4o-mini");
    expect(result.usage.primaryModel).toBe("openai/gpt-6-astra");
  });

  // 6. Schema failure does NOT trigger fallback
  it("6. Schema failure does NOT trigger fallback", async () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";
    process.env.FALLBACK_MODEL = "openai/gpt-4o-mini";

    const TargetSchema = z.object({
      correct: z.boolean(),
    });

    const completeSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
      content: JSON.stringify({ wrongField: "no correct boolean" }),
      model: "openai/gpt-6-astra",
      promptTokens: 20,
      completionTokens: 10,
    });

    await expect(
      aiGateway.generateStructured({
        task: "assessment",
        systemPrompt: "System",
        userPrompt: "Evaluate",
        promptVersion: "ASSESS_V1",
        schema: TargetSchema,
      })
    ).rejects.toThrow(/schema validation/);

    // Operational fallback was NOT triggered
    expect(completeSpy).toHaveBeenCalledTimes(1);
  });

  // 7. Fallback is visible in telemetry
  it("7. Fallback is visible in telemetry with primaryModel captured", async () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";
    process.env.FALLBACK_MODEL = "openai/gpt-4o-mini";

    vi.spyOn(openRouterClient, "complete")
      .mockRejectedValueOnce(new Error("ETIMEDOUT: Connection timed out"))
      .mockResolvedValueOnce({
        content: "OK",
        model: "openai/gpt-4o-mini",
        promptTokens: 10,
        completionTokens: 5,
      });

    const result = await aiGateway.generateText({
      task: "tutor",
      systemPrompt: "Sys",
      userPrompt: "Prompt",
      promptVersion: "V1",
    });

    const records = telemetryService.getUsageRecords();
    const record = records[0];

    expect(record).toBeDefined();
    expect(record.fallbackUsed).toBe(true);
    expect(record.fallbackModel).toBe("openai/gpt-4o-mini");
    expect(record.primaryModel).toBe("openai/gpt-6-astra");
    expect(record.model).toBe("openai/gpt-4o-mini");
    expect(result.usage.primaryModel).toBe("openai/gpt-6-astra");
  });

  // 8. Policy version is recorded
  it("8. Policy version is recorded as EDUIA_POLICY_V2", () => {
    process.env.EDUIA_PRIMARY_MODEL = "openai/gpt-6-astra";

    const decision = aiModelOrchestrator.selectModel({ task: "diagnostic" });
    expect(decision.policyVersion).toBe("EDUIA_POLICY_V2");
    expect(ORCHESTRATION_POLICY_VERSION).toBe("EDUIA_POLICY_V2");
  });

  // 9. Astra unavailability produces explicit configuration/availability state
  it("9. Astra unavailability produces explicit BLOCKED state", () => {
    delete process.env.EDUIA_PRIMARY_MODEL;
    delete process.env.DEFAULT_MODEL;

    const status = verifyAstraStatus();
    expect(status.verified).toBe(false);
    expect(status.status).toBe("BLOCKED");
    expect(status.reason).toContain("empty");
  });

  // 10. No fake Astra ID is fabricated
  it("10. No fake Astra ID is fabricated", () => {
    const status = verifyModelStatus("astra/fictitious-fabricated-endpoint");
    expect(status.verificationStatus).toBe("BLOCKED");
  });

  // 11. Pedagogical evaluation dimensions evaluate correctly
  it("11. Pedagogical evaluation dimensions assess deterministic quality", () => {
    // Tutor pedagogical dimensions
    const tutorGood = evaluatePedagogicalTask("tutor", {
      rawText:
        "Welcome! In Python, variables are not physical storage boxes; instead, think of them as sticky labels or references attached to objects in memory. For example: x = 10 attaches label x to integer 10. Now try this: what do you predict happens if we do y = x and then change x?",
    });

    expect(tutorGood.pedagogicalScore).toBeGreaterThanOrEqual(80);
    expect(tutorGood.dimensions.some((d) => d.name === "misconceptionHandling" && d.score === 100)).toBe(true);
    expect(tutorGood.dimensions.some((d) => d.name === "actionableNextStep" && d.score === 100)).toBe(true);

    // Tutor missing code and check question
    const tutorBad = evaluatePedagogicalTask("tutor", {
      rawText: "Variables store things in programming.",
    });
    expect(tutorBad.pedagogicalScore).toBeLessThan(60);
  });
});
