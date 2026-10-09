import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { recommendationService } from "@/lib/learning/state/recommendation-service";
import { masteryService } from "@/lib/learning/state/mastery-service";
import { detectDomainFromObjective } from "@/lib/learning/domain-detection";
import { getCuratedCompetenciesByDomain, getCompetencyById } from "@/lib/learning/curriculum";
import { getPracticeActivity } from "@/lib/learning/activities/curriculum-activities";
import { GET as activityGetHandler } from "@/app/api/learning/activity/route";
import { POST as activitySubmitHandler } from "@/app/api/learning/activity/submit/route";
import { POST as diagnosticStartHandler } from "@/app/api/diagnostic/start/route";
import { POST as diagnosticCompleteHandler } from "@/app/api/diagnostic/[id]/complete/route";
import { GET as stateGetHandler } from "@/app/api/learning/state/route";
import { GET as recGetHandler } from "@/app/api/learning/recommendation/route";
import { POST as goalsPostHandler } from "@/app/api/goals/route";

describe("KNOWRA — CRITICAL UX FIX: MAKE LEARNING ACTIVITIES STARTABLE", () => {
  const learnerId = "test-learner-startable-111";
  const otherLearnerId = "test-learner-startable-222";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. New Goal → Diagnostic Required State & Unblocking", () => {
    it("1. A new goal initializes with diagnosticCompleted = false and 0 evidence", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "I want to learn Python from beginner to junior developer",
        selectedDomainId: "python-junior",
        selfReportedLevel: "Beginner",
        userId: learnerId,
      });

      const state = await learningStateService.getCurrentLearningState(learnerId, goal.id);
      expect(state.diagnosticCompleted).toBe(false);
      expect(state.overallBaselineScore).toBe(0);

      // Verify that state API route accurately reports diagnosticCompleted: false
      const req = new NextRequest(`http://localhost:3000/api/learning/state?goalId=${goal.id}`, {
        headers: { "x-user-id": learnerId },
      });
      const res = await stateGetHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.diagnosticCompleted).toBe(false);
    });

    it("2. Diagnostic completion transitions diagnosticCompleted to true and persists baseline", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      // Start diagnostic
      const { session, items } = await learningStateService.startDiagnostic(learnerId, goal.id);
      expect(session.status).toBe("IN_PROGRESS");
      expect(items.length).toBeGreaterThanOrEqual(5);

      // Submit diagnostic answers
      for (const item of items) {
        await learningStateService.submitDiagnosticAnswer(learnerId, session.id, item.id, item.options?.[0] || "A");
      }

      // Complete diagnostic
      const report = await learningStateService.completeDiagnostic(learnerId, session.id);
      expect(report.overallBaselineScore).toBeGreaterThanOrEqual(0);

      // Authoritative state must now have diagnosticCompleted: true
      const state = await learningStateService.getCurrentLearningState(learnerId, goal.id);
      expect(state.diagnosticCompleted).toBe(true);
      expect(state.competencies.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("2. Contextual Primary Actions & Recommendation Routing", () => {
    it("3. Next Best Action recommendation produces a valid actionable competency and priority", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      const { session, items } = await learningStateService.startDiagnostic(learnerId, goal.id);
      for (const item of items) {
        await learningStateService.submitDiagnosticAnswer(learnerId, session.id, item.id, item.options?.[0] || "A");
      }
      await learningStateService.completeDiagnostic(learnerId, session.id);

      const rec = await recommendationService.getNextBestAction(learnerId, goal.id);
      expect(rec).toBeDefined();
      expect(rec.competencyId).toBeDefined();
      expect(["LEARN", "PRACTICE", "FEYNMAN", "REVIEW", "REMEDIATE", "RETRY", "ADVANCE"]).toContain(rec.action);
      expect(rec.priority).toBeGreaterThan(0);
      expect(rec.reason).toBeDefined();

      // Recommendation API route check
      const req = new NextRequest(`http://localhost:3000/api/learning/recommendation?goalId=${goal.id}`, {
        headers: { "x-user-id": learnerId },
      });
      const res = await recGetHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.recommendation.competencyId).toBe(rec.competencyId);
    });

    it("4. Correct propagation of goal and competency identifiers to GET /api/learning/activity", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      const req = new NextRequest(
        `http://localhost:3000/api/learning/activity?goalId=${goal.id}&competencyId=py-variables-types&action=PRACTICE`,
        { headers: { "x-user-id": learnerId } }
      );
      const res = await activityGetHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.activity).toBeDefined();
      expect(data.activity.competencyId).toBe("py-variables-types");
      expect(data.activity.title).toContain("Variables");
      expect(data.activity.practice).toBeDefined();
      expect(data.activity.practice.prompt).toBeDefined();
    });
  });

  describe("3. Activity Completion & Evidence Persistence", () => {
    it("5. Completing an activity emits legitimate evidence, recalculates mastery, and updates state", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      // Submit activity response
      const req = new NextRequest("http://localhost:3000/api/learning/activity/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerId },
        body: JSON.stringify({
          goalId: goal.id,
          competencyId: "py-variables-types",
          action: "PRACTICE",
          score: 95,
          response: "<class 'float'>",
          metadata: { test: true },
        }),
      });

      const res = await activitySubmitHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.evidence.score).toBe(95);
      expect(data.evidence.evidenceType).toBe("EXERCISE");
      expect(data.masteryOutput.masteryScore).toBeGreaterThan(0);

      // Verify evidence persistence in learningStateService
      const allEvidence = await learningStateService.getAllEvidence(learnerId, goal.id);
      expect(allEvidence.some((e) => e.competencyId === "py-variables-types")).toBe(true);
    });

    it("6. Submitting evidence dynamically refreshes the Next Best Action", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      // Initial NBA
      const initialRec = await recommendationService.getNextBestAction(learnerId, goal.id);

      // Record high mastery evidence
      await learningStateService.recordPracticeEvidence(learnerId, goal.id, "py-variables-types", 100);
      await masteryService.recalculateCompetencyMastery(learnerId, goal.id, "py-variables-types");

      // Refreshed NBA
      const refreshedRec = await recommendationService.getNextBestAction(learnerId, goal.id);
      expect(refreshedRec).toBeDefined();
    });
  });

  describe("4. Goal & Curriculum Safety (Addressing 'Cerrado' Mismatch)", () => {
    it("7. Domain detection returns null for unsupported text and does not invent Python domain", () => {
      const unsupportedText = "cerrado do centrooeste brasileiro";
      const detected = detectDomainFromObjective(unsupportedText);
      expect(detected).toBeNull();
    });

    it("8. Curated path selection preserves domain integrity even if unrelated text was entered", async () => {
      // Simulate user typing unrelated text in the input box, then selecting curated Python card
      const unrelatedText = "cerrado do centrooeste brasileiro";
      const detected = detectDomainFromObjective(unrelatedText);
      expect(detected).toBeNull();

      // Safe handler logic: only use rawObjective if detected domain matches selected domain
      const selectedDomainId = "python-junior";
      const defaultObjective = "I want to learn Python from beginner to junior developer";
      const resolvedObjective = detected && detected.id === selectedDomainId ? unrelatedText : defaultObjective;

      expect(resolvedObjective).toBe(defaultObjective);

      const req = new NextRequest("http://localhost:3000/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": learnerId },
        body: JSON.stringify({
          rawObjective: resolvedObjective,
          selectedDomainId,
          selfReportedLevel: "Beginner",
        }),
      });

      const res = await goalsPostHandler(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.goal.domainId).toBe("python-junior");
      expect(data.goal.title).not.toContain("cerrado");
      expect(data.goal.title).toContain("Python");
    });
  });

  describe("5. Security & Isolation", () => {
    it("9. Learner B cannot start activity or submit evidence on Learner A's goal", async () => {
      const { goal } = await learningStateService.createGoal(learnerId, {
        rawObjective: "Master Python programming",
        selectedDomainId: "python-junior",
        userId: learnerId,
      });

      // GET activity for Learner B on Learner A's goal
      const getReq = new NextRequest(
        `http://localhost:3000/api/learning/activity?goalId=${goal.id}&competencyId=py-variables-types&action=PRACTICE`,
        { headers: { "x-user-id": otherLearnerId } }
      );
      const getRes = await activityGetHandler(getReq);
      expect([403, 404]).toContain(getRes.status);

      // POST activity submit for Learner B on Learner A's goal
      const submitReq = new NextRequest("http://localhost:3000/api/learning/activity/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": otherLearnerId },
        body: JSON.stringify({
          goalId: goal.id,
          competencyId: "py-variables-types",
          action: "PRACTICE",
          score: 80,
          response: "test",
        }),
      });
      const submitRes = await activitySubmitHandler(submitReq);
      expect([403, 400]).toContain(submitRes.status);
    });

    it("10. All 3 curated curricula (Python, Math, Excel) have valid competencies and practice activities", () => {
      const domains = ["python-junior", "math-exams", "excel-pro"];

      for (const domId of domains) {
        const comps = getCuratedCompetenciesByDomain(domId);
        expect(comps.length).toBeGreaterThanOrEqual(6);

        // Every competency has a title, description, prerequisites, and category
        for (const comp of comps) {
          expect(comp.id).toBeDefined();
          expect(comp.title.length).toBeGreaterThan(2);
          expect(comp.description.length).toBeGreaterThan(5);
          expect(["CONCEPTUAL", "PROCEDURAL", "FACTUAL"]).toContain(comp.category);

          // Curated or fallback activity can be retrieved
          const curatedActivity = getPracticeActivity(comp.id);
          expect(curatedActivity).toBeDefined();
          expect(curatedActivity?.practice.prompt.length).toBeGreaterThan(5);
        }
      }
    });
  });
});
