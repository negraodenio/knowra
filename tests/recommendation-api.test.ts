import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getRecommendation } from "@/app/api/learning/recommendation/route";
import { POST as acceptRecommendation } from "@/app/api/learning/recommendation/[id]/accept/route";
import { POST as skipRecommendation } from "@/app/api/learning/recommendation/[id]/skip/route";
import { POST as completeRecommendation } from "@/app/api/learning/recommendation/[id]/complete/route";
import { GET as getPlan } from "@/app/api/learning/plan/route";
import { learningStateService } from "@/lib/learning/state/learning-state-service";

describe("Adaptive Loop API Endpoints (§48, §49)", () => {
  const userA = "aaaa1111-1111-1111-1111-111111111111";
  const userB = "bbbb2222-2222-2222-2222-222222222222";
  let goalIdUserA: string;

  beforeEach(async () => {
    const { goal } = await learningStateService.createGoal(userA, {
      rawObjective: "Learn Python Developer curriculum",
      selectedDomainId: "python-junior",
    });
    goalIdUserA = goal.id;
  });

  it("GET /api/learning/recommendation returns active Next Best Action", async () => {
    const req = new NextRequest(`http://localhost:3000/api/learning/recommendation?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userA },
    });

    const res = await getRecommendation(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.recommendation).toBeDefined();
    expect(data.recommendation.action).toBeDefined();
    expect(data.recommendation.priority).toBeGreaterThanOrEqual(0);
    expect(data.recommendation.reason).toBeDefined();
  });

  it("Full recommendation acceptance lifecycle through API routes", async () => {
    // 1. Fetch initial recommendation
    const getReq = new NextRequest(`http://localhost:3000/api/learning/recommendation?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userA },
    });
    const getRes = await getRecommendation(getReq);
    const { recommendation } = await getRes.json();
    const recId = recommendation.id;

    // 2. Accept recommendation
    const acceptReq = new NextRequest(`http://localhost:3000/api/learning/recommendation/${recId}/accept`, {
      method: "POST",
      headers: { "x-user-id": userA },
    });
    const acceptRes = await acceptRecommendation(acceptReq, { params: Promise.resolve({ id: recId }) });
    expect(acceptRes.status).toBe(200);
    const acceptData = await acceptRes.json();
    expect(acceptData.recommendation.status).toBe("ACCEPTED");

    // 3. Complete recommendation
    const compReq = new NextRequest(`http://localhost:3000/api/learning/recommendation/${recId}/complete`, {
      method: "POST",
      headers: { "x-user-id": userA },
    });
    const compRes = await completeRecommendation(compReq, { params: Promise.resolve({ id: recId }) });
    expect(compRes.status).toBe(200);
    const compData = await compRes.json();
    expect(compData.recommendation.status).toBe("COMPLETED");
  });

  it("Skip recommendation flow through API", async () => {
    const getReq = new NextRequest(`http://localhost:3000/api/learning/recommendation?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userA },
    });
    const getRes = await getRecommendation(getReq);
    const { recommendation } = await getRes.json();

    const skipReq = new NextRequest(`http://localhost:3000/api/learning/recommendation/${recommendation.id}/skip`, {
      method: "POST",
      headers: { "x-user-id": userA },
    });
    const skipRes = await skipRecommendation(skipReq, { params: Promise.resolve({ id: recommendation.id }) });
    expect(skipRes.status).toBe(200);
    const skipData = await skipRes.json();
    expect(skipData.recommendation.status).toBe("SKIPPED");
  });

  it("GET /api/learning/plan returns dynamic adaptive plan", async () => {
    const req = new NextRequest(`http://localhost:3000/api/learning/plan?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userA },
    });

    const res = await getPlan(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.plan).toBeDefined();
    expect(data.plan.steps.length).toBeGreaterThan(0);
    expect(data.plan.totalEstimatedMinutes).toBeGreaterThan(0);
  });

  it("Cross-User Security: User B receives 403 when attempting to access User A's recommendations or plan", async () => {
    // User B attempts to get User A's recommendation
    const recReq = new NextRequest(`http://localhost:3000/api/learning/recommendation?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userB },
    });
    const recRes = await getRecommendation(recReq);
    expect(recRes.status).toBe(403);

    // User B attempts to get User A's plan
    const planReq = new NextRequest(`http://localhost:3000/api/learning/plan?goalId=${goalIdUserA}`, {
      headers: { "x-user-id": userB },
    });
    const planRes = await getPlan(planReq);
    expect(planRes.status).toBe(403);
  });
});
