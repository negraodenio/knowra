import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { aiGateway } from "@/lib/ai/gateway";
import { openRouterClient } from "@/lib/ai/openrouter";

describe("AI Gateway & Structured Validation (§28, §32)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const TestSchema = z.object({
    competencyId: z.string(),
    confidence: z.number().min(0).max(1),
    feedback: z.string(),
  });

  it("successfully parses and validates compliant JSON output", async () => {
    vi.spyOn(openRouterClient, "complete").mockResolvedValue({
      content: JSON.stringify({
        competencyId: "py-functions",
        confidence: 0.88,
        feedback: "Demonstrated clear parameter scope comprehension.",
      }),
      model: "anthropic/claude-3.5-sonnet",
      promptTokens: 120,
      completionTokens: 45,
    });

    const result = await aiGateway.generateStructured({
      task: "CLASSIFIER",
      systemPrompt: "You are a classifier.",
      userPrompt: "Classify this learner performance.",
      promptVersion: "CLASSIFIER_V1",
      schema: TestSchema,
    });

    expect(result.data.competencyId).toBe("py-functions");
    expect(result.data.confidence).toBe(0.88);
    expect(result.usage.promptTokens).toBe(120);
    expect(result.usage.completionTokens).toBe(45);
    expect(result.usage.status).toBe("SUCCESS");
  });

  it("handles and strips markdown code fences from JSON output", async () => {
    const rawWithMarkdown = "```json\n" + JSON.stringify({
      competencyId: "py-loops",
      confidence: 0.95,
      feedback: "Iterative structure correct.",
    }) + "\n```";

    vi.spyOn(openRouterClient, "complete").mockResolvedValue({
      content: rawWithMarkdown,
      model: "openai/gpt-4o-mini",
      promptTokens: 80,
      completionTokens: 30,
    });

    const result = await aiGateway.generateStructured({
      task: "CLASSIFIER",
      systemPrompt: "You are a classifier.",
      userPrompt: "Evaluate input.",
      promptVersion: "CLASSIFIER_V1",
      schema: TestSchema,
    });

    expect(result.data.competencyId).toBe("py-loops");
    expect(result.data.confidence).toBe(0.95);
  });

  it("throws and records schema error when AI output violates Zod schema (§32, §58)", async () => {
    // Missing required field 'feedback' and confidence out of bounds
    vi.spyOn(openRouterClient, "complete").mockResolvedValue({
      content: JSON.stringify({
        competencyId: "py-error",
        confidence: 5.0, // Invalid: exceeds max 1
      }),
      model: "openai/gpt-4o-mini",
      promptTokens: 50,
      completionTokens: 20,
    });

    await expect(
      aiGateway.generateStructured({
        task: "CLASSIFIER",
        systemPrompt: "System",
        userPrompt: "User",
        promptVersion: "CLASSIFIER_V1",
        schema: TestSchema,
      })
    ).rejects.toThrow(/AI output failed schema validation/);
  });

  it("throws and catches invalid non-JSON output without crashing process", async () => {
    vi.spyOn(openRouterClient, "complete").mockResolvedValue({
      content: "I am unable to answer this question in JSON format.",
      model: "openai/gpt-4o-mini",
      promptTokens: 25,
      completionTokens: 15,
    });

    await expect(
      aiGateway.generateStructured({
        task: "CLASSIFIER",
        systemPrompt: "System",
        userPrompt: "User",
        promptVersion: "CLASSIFIER_V1",
        schema: TestSchema,
      })
    ).rejects.toThrow(/Failed to parse AI output as JSON/);
  });
});
