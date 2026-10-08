import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getGoals, POST as createGoal, PATCH as patchGoal } from "@/app/api/goals/route";
import { POST as startDiagnostic } from "@/app/api/diagnostic/start/route";
import { POST as submitDiagnosticAnswer } from "@/app/api/diagnostic/[id]/answer/route";
import { POST as completeDiagnostic } from "@/app/api/diagnostic/[id]/complete/route";
import { GET as getRecommendation } from "@/app/api/learning/recommendation/route";
import { POST as acceptRecommendation } from "@/app/api/learning/recommendation/[id]/accept/route";
import { GET as getState } from "@/app/api/learning/state/route";
import { GET as getGaps } from "@/app/api/learning/gaps/route";
import { GET as getActivity } from "@/app/api/learning/activity/route";
import { POST as submitActivity } from "@/app/api/learning/activity/submit/route";
import { GET as getHistory } from "@/app/api/learning/history/route";
import { POST as startAssessment } from "@/app/api/learning/assessment/start/route";
import { POST as answerAssessment } from "@/app/api/learning/assessment/[id]/answer/route";
import { POST as submitAssessment } from "@/app/api/learning/assessment/[id]/submit/route";
import { GET as getGain } from "@/app/api/learning/gain/[goalId]/route";
import { learningStateService } from "@/lib/learning/state/learning-state-service";

describe("S8 — Productization & Learner Experience Tests", () => {
  const learnerA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const learnerB = "22222222-bbbb-bbbb-bbbb-222222222222";
  let goalAId: string;

  beforeEach(async () => {
    // Clean initial goal setup for learner A
    const req = new NextRequest("http://localhost:3000/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": learnerA },
      body: JSON.stringify({
        rawObjective: "I want to become proficient in Python programming",
        selectedDomainId: "python-junior",
        selfReportedLevel: "Beginner",
      }),
    });
    const res = await createGoal(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    goalAId = data.goal.id;
  });

  describe("A & B. Goal Creation, Listing & Retrieval (§7, §8)", () => {
    it("lists goals and retrieves the active goal for the learner", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals", {
        headers: { "x-user-id": learnerA },
      });
      const res = await getGoals(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.goals).toBeDefined();
      expect(data.goals.length).toBeGreaterThanOrEqual(1);
      expect(data.activeGoal).toBeDefined();
      expect(data.activeGoal.id).toBe(goalAId);
      expect(data.activeGoal.domainId).toBe("python-junior");
    });

    it("retrieves a specific goal by ID with ownership verification", async () => {
      const req = new NextRequest(`http://localhost:3000/api/goals?goalId=${goalAId}`, {
        headers: { "x-user-id": learnerA },
      });
      const res = await getGoals(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.goal.id).toBe(goalAId);
      expect(data.goal.userId).toBe(learnerA);
    });

    it("updates active goal via PATCH", async () => {
      // Create a second goal
      const createReq = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({
          rawObjective: "Master Excel formulas and data analysis",
          selectedDomainId: "excel-pro",
          selfReportedLevel: "Intermediate",
        }),
      });
      const createRes = await createGoal(createReq);
      const { goal: goal2 } = await createRes.json();

      // Switch active goal
      const patchReq = new NextRequest("http://localhost:3000/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({ activeGoalId: goal2.id }),
      });
      const patchRes = await patchGoal(patchReq);
      expect(patchRes.status).toBe(200);

      // Verify active goal changed
      const getReq = new NextRequest("http://localhost:3000/api/goals", {
        headers: { "x-user-id": learnerA },
      });
      const getRes = await getGoals(getReq);
      const data = await getRes.json();
      expect(data.activeGoal.id).toBe(goal2.id);
    });
  });

  describe("C & M. Auth Protection & Cross-User Isolation (§22, §38)", () => {
    it("returns 401 Unauthorized when no user credentials are provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/goals");
      const res = await getGoals(req);
      expect(res.status).toBe(401);
    });

    it("prevents Learner B from accessing Learner A's goal (403)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/goals?goalId=${goalAId}`, {
        headers: { "x-user-id": learnerB },
      });
      const res = await getGoals(req);
      expect(res.status).toBe(403);
    });

    it("prevents Learner B from accessing Learner A's learning state (403)", async () => {
      const req = new NextRequest(`http://localhost:3000/api/learning/state?goalId=${goalAId}`, {
        headers: { "x-user-id": learnerB },
      });
      const res = await getState(req);
      expect(res.status).toBe(403);
    });
  });

  describe("D, E, F. Diagnostic Flow -> Learning Map -> Next Best Action (§9, §10, §11)", () => {
    it("completes diagnostic, preserves baseline score, and generates initial recommendation", async () => {
      // 1. Start diagnostic
      const startReq = new NextRequest("http://localhost:3000/api/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({ goalId: goalAId }),
      });
      const startRes = await startDiagnostic(startReq);
      expect(startRes.status).toBe(201);
      const { session, items } = await startRes.json();
      expect(items.length).toBeGreaterThan(0);

      // 2. Submit answers to all diagnostic questions
      for (const item of items) {
        const answerReq = new NextRequest(
          `http://localhost:3000/api/diagnostic/${session.id}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": learnerA },
            body: JSON.stringify({
              itemId: item.id,
              answer: item.options ? item.options[0] : "10",
            }),
          }
        );
        const ansRes = await submitDiagnosticAnswer(answerReq, {
          params: Promise.resolve({ id: session.id }),
        });
        expect(ansRes.status).toBe(200);
      }

      // 3. Complete diagnostic
      const compReq = new NextRequest(
        `http://localhost:3000/api/diagnostic/${session.id}/complete`,
        {
          method: "POST",
          headers: { "x-user-id": learnerA },
        }
      );
      const compRes = await completeDiagnostic(compReq, {
        params: Promise.resolve({ id: session.id }),
      });
      expect(compRes.status).toBe(200);
      const report = await compRes.json();
      expect(report.overallBaselineScore).toBeGreaterThanOrEqual(0);
      expect(report.competencyBaselines.length).toBeGreaterThan(0);

      // 4. Learning Map shows preserved baselines
      const stateReq = new NextRequest(
        `http://localhost:3000/api/learning/state?goalId=${goalAId}`,
        {
          headers: { "x-user-id": learnerA },
        }
      );
      const stateRes = await getState(stateReq);
      expect(stateRes.status).toBe(200);
      const stateData = await stateRes.json();
      expect(stateData.diagnosticCompleted).toBe(true);
      expect(stateData.overallBaselineScore).toBe(report.overallBaselineScore);

      // 5. Next Best Action recommendation is generated
      const recReq = new NextRequest(
        `http://localhost:3000/api/learning/recommendation?goalId=${goalAId}`,
        {
          headers: { "x-user-id": learnerA },
        }
      );
      const recRes = await getRecommendation(recReq);
      expect(recRes.status).toBe(200);
      const recData = await recRes.json();
      expect(recData.recommendation).toBeDefined();
      expect(["LEARN", "PRACTICE", "FEYNMAN", "REVIEW", "REMEDIATE", "RETRY", "ADVANCE"]).toContain(
        recData.recommendation.action
      );
      expect(recData.recommendation.reason).toBeDefined();
    });
  });

  describe("G, H, I, J. Activity Execution -> Evidence -> Mastery Refresh -> Refreshed NBA (§13, §14, §15)", () => {
    it("executes practice activity, records legitimate evidence, refreshes mastery, and updates recommendation", async () => {
      // 1. Fetch contextual activity content
      const actReq = new NextRequest(
        `http://localhost:3000/api/learning/activity?goalId=${goalAId}&competencyId=py-variables-types&action=PRACTICE`,
        {
          headers: { "x-user-id": learnerA },
        }
      );
      const actRes = await getActivity(actReq);
      expect(actRes.status).toBe(200);
      const { activity } = await actRes.json();
      expect(activity.competencyId).toBe("py-variables-types");
      expect(activity.practice).toBeDefined();

      // 2. Submit activity result producing verified evidence
      const subReq = new NextRequest("http://localhost:3000/api/learning/activity/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({
          goalId: goalAId,
          competencyId: "py-variables-types",
          action: "PRACTICE",
          score: 95,
          response: "<class 'float'>",
          metadata: { prompt: activity.practice.prompt },
        }),
      });
      const subRes = await submitActivity(subReq);
      expect(subRes.status).toBe(200);
      const subData = await subRes.json();

      // Verify legitimate evidence was recorded
      expect(subData.success).toBe(true);
      expect(subData.evidence).toBeDefined();
      expect(subData.evidence.score).toBe(95);
      expect(subData.evidence.result).toBe("SUCCESS");
      expect(subData.evidence.evidenceType).toBe("EXERCISE");

      // Verify mastery was recalculated deterministically
      expect(subData.masteryOutput).toBeDefined();
      expect(subData.masteryOutput.masteryScore).toBeGreaterThanOrEqual(70);

      // Verify refreshed Next Best Action was evaluated
      expect(subData.nextRecommendation).toBeDefined();
      expect(subData.nextRecommendation.action).toBeDefined();
    });
  });

  describe("K & N. Learning Gaps & Audit Timeline History (§16, §20, §21)", () => {
    it("retrieves learning gaps and verifies event emission in audit history", async () => {
      // 1. Query Gaps
      const gapsReq = new NextRequest(`http://localhost:3000/api/learning/gaps?goalId=${goalAId}`, {
        headers: { "x-user-id": learnerA },
      });
      const gapsRes = await getGaps(gapsReq);
      expect(gapsRes.status).toBe(200);
      const gapsData = await gapsRes.json();
      expect(Array.isArray(gapsData.gaps)).toBe(true);

      // 2. Query History events
      const histReq = new NextRequest(`http://localhost:3000/api/learning/history?goalId=${goalAId}`, {
        headers: { "x-user-id": learnerA },
      });
      const histRes = await getHistory(histReq);
      expect(histRes.status).toBe(200);
      const histData = await histRes.json();

      expect(histData.events).toBeDefined();
      expect(histData.events.length).toBeGreaterThan(0);
      // Verify goal_created event is present
      const goalCreatedEvent = histData.events.find((e: any) => e.eventType === "goal_created");
      expect(goalCreatedEvent).toBeDefined();
      expect(goalCreatedEvent.userId).toBe(learnerA);
    });
  });

  describe("L. Independent Assessment & Learning Gain (§18, §19)", () => {
    it("runs independent assessment and measures empirical learning gain", async () => {
      // 1. Establish diagnostic baseline first
      const diagReq = new NextRequest("http://localhost:3000/api/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({ goalId: goalAId }),
      });
      const diagRes = await startDiagnostic(diagReq);
      const { session: dSession, items: dItems } = await diagRes.json();

      for (const item of dItems) {
        const aReq = new NextRequest(
          `http://localhost:3000/api/diagnostic/${dSession.id}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": learnerA },
            body: JSON.stringify({
              itemId: item.id,
              answer: "dummy",
            }),
          }
        );
        await submitDiagnosticAnswer(aReq, { params: Promise.resolve({ id: dSession.id }) });
      }

      await completeDiagnostic(
        new NextRequest(`http://localhost:3000/api/diagnostic/${dSession.id}/complete`, {
          method: "POST",
          headers: { "x-user-id": learnerA },
        }),
        { params: Promise.resolve({ id: dSession.id }) }
      );

      // 2. Start Independent FINAL assessment
      const assessReq = new NextRequest("http://localhost:3000/api/learning/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerA },
        body: JSON.stringify({
          userId: learnerA,
          learningGoalId: goalAId,
          domainId: "python-junior",
          assessmentType: "FINAL",
        }),
      });
      const assessRes = await startAssessment(assessReq);
      expect(assessRes.status).toBe(201);
      const { session: aSession, items: aItems } = await assessRes.json();
      expect(aItems.length).toBeGreaterThan(0);

      // 3. Answer final assessment items
      for (const item of aItems) {
        const ansReq = new NextRequest(
          `http://localhost:3000/api/learning/assessment/${aSession.id}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-id": learnerA },
            body: JSON.stringify({
              userId: learnerA,
              itemId: item.id,
              answer: item.options ? item.options[0] : "10",
            }),
          }
        );
        const ansRes = await answerAssessment(ansReq, {
          params: Promise.resolve({ id: aSession.id }),
        });
        expect(ansRes.status).toBe(200);
      }

      // 4. Submit final assessment
      const subAssessReq = new NextRequest(
        `http://localhost:3000/api/learning/assessment/${aSession.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-id": learnerA },
          body: JSON.stringify({ userId: learnerA }),
        }
      );
      const subAssessRes = await submitAssessment(subAssessReq, {
        params: Promise.resolve({ id: aSession.id }),
      });
      expect(subAssessRes.status).toBe(200);
      const report = await subAssessRes.json();
      expect(report.scoreResult).toBeDefined();
      expect(report.learningGainReport).toBeDefined();
      expect(typeof report.learningGainReport.learningGain).toBe("number");

      // 5. Query Learning Gain Report endpoint
      const gainReq = new NextRequest(
        `http://localhost:3000/api/learning/gain/${goalAId}?userId=${learnerA}`,
        {
          headers: { "x-user-id": learnerA },
        }
      );
      const gainRes = await getGain(gainReq, { params: Promise.resolve({ goalId: goalAId }) });
      expect(gainRes.status).toBe(200);
      const gainData = await gainRes.json();
      expect(gainData.baseline).toBeDefined();
      expect(gainData.final).toBeDefined();
      expect(typeof gainData.learningGain).toBe("number");
    });
  });
});
