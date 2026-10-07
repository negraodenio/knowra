import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getReviewQueue } from "@/app/api/learning/review/route";
import { POST as startReviewSession } from "@/app/api/learning/review/session/route";
import { POST as answerReviewItem } from "@/app/api/learning/review/[id]/answer/route";
import { GET as getFeynmanSession } from "@/app/api/learning/feynman/[competencyId]/route";
import { POST as submitFeynmanExplanation } from "@/app/api/learning/feynman/[competencyId]/submit/route";
import { learningStateService } from "@/lib/learning/state/learning-state-service";
import { reviewService } from "@/lib/learning/state/review-service";
import { aiGateway } from "@/lib/ai/gateway";

describe("Sprint 6 API Routes (§24, §29)", () => {
  const userA = "api-user-A-1111-1111-1111-111111111111";
  const userB = "api-user-B-2222-2222-2222-222222222222";
  let goalIdUserA: string;

  beforeEach(async () => {
    const { goal } = await learningStateService.createGoal(userA, {
      rawObjective: "Learn Python Development",
      selectedDomainId: "python-junior",
    });
    goalIdUserA = goal.id;
  });

  describe("Review API Endpoints", () => {
    it("GET /api/learning/review returns queue and supports sessions", async () => {
      // Register an item
      await reviewService.ensureReviewItem(userA, goalIdUserA, "py-variables-types");

      const req = new NextRequest(`http://localhost:3000/api/learning/review?goalId=${goalIdUserA}`, {
        headers: { "x-user-id": userA },
      });
      const res = await getReviewQueue(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.queue.length).toBeGreaterThan(0);
    });

    it("POST /api/learning/review/[id]/answer records review rating and advances scheduler", async () => {
      const item = await reviewService.ensureReviewItem(userA, goalIdUserA, "py-variables-types");

      const req = new NextRequest(`http://localhost:3000/api/learning/review/${item.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userA },
        body: JSON.stringify({ rating: "GOOD", score: 85 }),
      });
      const res = await answerReviewItem(req, { params: Promise.resolve({ id: item.id }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.reviewItem.reviewCount).toBe(1);
    });

    it("User B receives 403 trying to answer User A's review item", async () => {
      const item = await reviewService.ensureReviewItem(userA, goalIdUserA, "py-variables-types");

      const req = new NextRequest(`http://localhost:3000/api/learning/review/${item.id}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userB },
        body: JSON.stringify({ rating: "GOOD", score: 85 }),
      });
      const res = await answerReviewItem(req, { params: Promise.resolve({ id: item.id }) });
      expect(res.status).toBe(403);
    });
  });

  describe("Feynman API Endpoints", () => {
    it("GET /api/learning/feynman/[competencyId] returns active Feynman session", async () => {
      const req = new NextRequest(`http://localhost:3000/api/learning/feynman/py-variables-types?goalId=${goalIdUserA}`, {
        headers: { "x-user-id": userA },
      });
      const res = await getFeynmanSession(req, { params: Promise.resolve({ competencyId: "py-variables-types" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.session.prompt).toBeDefined();
    });

    it("POST /api/learning/feynman/[competencyId]/submit evaluates explanation", async () => {
      // 1. Get session
      const getReq = new NextRequest(`http://localhost:3000/api/learning/feynman/py-variables-types?goalId=${goalIdUserA}`, {
        headers: { "x-user-id": userA },
      });
      const getRes = await getFeynmanSession(getReq, { params: Promise.resolve({ competencyId: "py-variables-types" }) });
      const { session } = await getRes.json();

      // 2. Mock AI Gateway structured evaluation
      const spy = vi.spyOn(aiGateway, "generateStructured").mockResolvedValueOnce({
        data: {
          correctness: 90,
          completeness: 85,
          simplicity: 90,
          causal_reasoning: 80,
          misconception_penalty: 0,
          overall_score: 87,
          confidence: 0.8,
          missing_concepts: [],
          misconceptions: [],
          feedback: "Great simple explanation.",
          rubric_version: "v1",
        },
        rawText: "{}",
        usage: {
          userId: userA,
          operation: "generateStructured:FEYNMAN",
          task: "FEYNMAN",
          provider: "openrouter",
          model: "anthropic/claude-3.5-sonnet",
          promptTokens: 80,
          completionTokens: 40,
          totalTokens: 120,
          estimatedCost: 0.001,
          latencyMs: 100,
          timestamp: new Date().toISOString(),
          status: "SUCCESS",
        },
        model: "anthropic/claude-3.5-sonnet",
        promptVersion: "FEYNMAN_EVAL_V1",
      });

      const submitReq = new NextRequest(`http://localhost:3000/api/learning/feynman/py-variables-types/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userA },
        body: JSON.stringify({
          sessionId: session.id,
          explanation: "Variables store data under named labels like storage containers.",
        }),
      });

      const submitRes = await submitFeynmanExplanation(submitReq, { params: Promise.resolve({ competencyId: "py-variables-types" }) });
      expect(submitRes.status).toBe(200);
      const submitData = await submitRes.json();
      expect(submitData.success).toBe(true);
      expect(submitData.session.evaluation.overall_score).toBeGreaterThanOrEqual(70);

      spy.mockRestore();
    });
  });
});
