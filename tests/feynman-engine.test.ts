import { describe, it, expect, beforeEach, vi } from "vitest";
import { feynmanService } from "@/lib/learning/state/feynman-service";
import { learningStateService } from "@/lib/learning/state/learning-state-service";
import { masteryService } from "@/lib/learning/state/mastery-service";
import {
  calculateFeynmanScore,
  DEFAULT_FEYNMAN_RUBRIC,
  FEYNMAN_RUBRIC_VERSION,
} from "@/lib/learning/feynman/rubric";
import { aiGateway } from "@/lib/ai/gateway";

describe("Feynman Explanation Engine (§4–10, §26, §27, §32)", () => {
  const userId = "feynman-test-user-1";
  let goalId: string;
  const targetCompId = "py-variables-types";

  beforeEach(async () => {
    const { goal } = await learningStateService.createGoal(userId, {
      rawObjective: "Learn Python for beginners",
      selectedDomainId: "python-junior",
    });
    goalId = goal.id;
  });

  describe("Deterministic Rubric Scoring (§5, §6)", () => {
    it("calculates score deterministically using versioned rubric v1 weights", () => {
      expect(FEYNMAN_RUBRIC_VERSION).toBe("v1");

      const score = calculateFeynmanScore(
        {
          correctness: 90,       // 90 * 0.30 = 27
          completeness: 80,      // 80 * 0.25 = 20
          causal_reasoning: 75,  // 75 * 0.20 = 15
          simplicity: 85,        // 85 * 0.10 = 8.5
          misconception_penalty: 0, // 0 * 0.15 = 0
        },
        DEFAULT_FEYNMAN_RUBRIC
      );

      // Expected: 27 + 20 + 15 + 8.5 - 0 = 70.5 -> round = 71
      expect(score).toBe(71);
    });

    it("applies penalty for misconceptions", () => {
      const cleanScore = calculateFeynmanScore({
        correctness: 80,
        completeness: 80,
        causal_reasoning: 80,
        simplicity: 80,
        misconception_penalty: 0,
      });

      const penalScore = calculateFeynmanScore({
        correctness: 80,
        completeness: 80,
        causal_reasoning: 80,
        simplicity: 80,
        misconception_penalty: 50, // 50 * 0.15 = 7.5 deduction
      });

      expect(penalScore).toBeLessThan(cleanScore);
    });
  });

  describe("Session Lifecycle & Evidence Integration (§4, §5, §7)", () => {
    it("creates a session with deterministic prompt and progresses through SUBMITTED -> EVALUATED", async () => {
      // 1. Start Session
      const session = await feynmanService.startSession(userId, goalId, targetCompId);
      expect(session.status).toBe("STARTED");
      expect(session.prompt).toContain("Variables and Primitive Data Types");


      // 2. Mock AI Gateway structured generation with high-quality explanation evaluation
      const spy = vi.spyOn(aiGateway, "generateStructured").mockResolvedValueOnce({
        data: {
          correctness: 95,
          completeness: 90,
          simplicity: 85,
          causal_reasoning: 88,
          misconception_penalty: 0,
          overall_score: 91,
          confidence: 0.85,
          missing_concepts: [],
          misconceptions: [],
          feedback: "Outstanding conceptual explanation using the box analogy.",
          rubric_version: "v1",
        },
        rawText: "{}",
        usage: {
          userId,
          operation: "generateStructured:FEYNMAN",
          task: "FEYNMAN",
          provider: "openrouter",
          model: "anthropic/claude-3.5-sonnet",
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
          estimatedCost: 0.001,
          latencyMs: 120,
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
        },
        model: "anthropic/claude-3.5-sonnet",
        promptVersion: "FEYNMAN_EVAL_V1",
      });

      const explanationText = "Think of a variable as a labeled storage box in your computer's memory. The label is the name, and what is inside is the data value.";
      const result = await feynmanService.submitExplanation(userId, session.id, explanationText);

      expect(result.success).toBe(true);
      expect(result.session?.status).toBe("EVALUATED");
      expect(result.session?.evaluation?.overall_score).toBeGreaterThanOrEqual(75);

      // 3. Verify append-only evidence was created with FEYNMAN evidence type
      const evidenceList = await learningStateService.getAllEvidence(userId, goalId);
      const feynmanEv = evidenceList.find((e) => e.evidenceType === "FEYNMAN");
      expect(feynmanEv).toBeDefined();
      expect(feynmanEv?.score).toBe(result.session?.evaluation?.overall_score);
      expect(feynmanEv?.result).toBe("SUCCESS");

      // 4. Verify mastery recalculation was triggered
      expect(result.masteryOutput).toBeDefined();

      spy.mockRestore();
    });

    it("INVARIANT: Single weak Feynman response does NOT automatically create a gap (§10)", async () => {
      const session = await feynmanService.startSession(userId, goalId, targetCompId);

      // Mock weak explanation evaluation
      const spy = vi.spyOn(aiGateway, "generateStructured").mockResolvedValueOnce({
        data: {
          correctness: 40,
          completeness: 35,
          simplicity: 50,
          causal_reasoning: 30,
          misconception_penalty: 20,
          overall_score: 35,
          confidence: 0.6,
          missing_concepts: ["Types", "Reassignment"],
          misconceptions: ["Variables can only hold numbers."],
          feedback: "Explanation was incomplete and contained errors.",
          rubric_version: "v1",
        },
        rawText: "{}",
        usage: {
          userId,
          operation: "generateStructured:FEYNMAN",
          task: "FEYNMAN",
          provider: "openrouter",
          model: "anthropic/claude-3.5-sonnet",
          promptTokens: 70,
          completionTokens: 30,
          totalTokens: 100,
          estimatedCost: 0.0005,
          latencyMs: 80,
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
        },
        model: "anthropic/claude-3.5-sonnet",
        promptVersion: "FEYNMAN_EVAL_V1",
      });

      await feynmanService.submitExplanation(
        userId,
        session.id,
        "A variable is like a number that doesn't change."
      );

      // Invariant check: Single observation must NOT declare an active gap (requires >= 2 independent signals per S4)
      const gaps = await masteryService.getGaps(userId, goalId);
      const compGap = gaps.find((g) => g.competencyId === targetCompId && g.status === "OPEN");
      expect(compGap).toBeUndefined();

      spy.mockRestore();
    });

    it("SAFE AI FAILURE: LLM failure produces NO learning evidence (§27)", async () => {
      const session = await feynmanService.startSession(userId, goalId, targetCompId);
      const evidenceBefore = await learningStateService.getAllEvidence(userId, goalId);

      // Mock AI Gateway failure (e.g. OpenRouter timeout or schema error)
      const spy = vi.spyOn(aiGateway, "generateStructured").mockRejectedValueOnce(
        new Error("OpenRouter API 504 Gateway Timeout")
      );

      const result = await feynmanService.submitExplanation(
        userId,
        session.id,
        "A variable is a labeled container for values in programming."
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Gateway Timeout");

      // Invariant check: NO evidence created upon AI failure
      const evidenceAfter = await learningStateService.getAllEvidence(userId, goalId);
      expect(evidenceAfter.length).toBe(evidenceBefore.length);

      spy.mockRestore();
    });
  });
});
