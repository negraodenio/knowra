import { describe, it, expect, beforeEach } from "vitest";
import {
  LearningStateService,
  UnauthorizedAccessError,
} from "@/lib/learning/state/learning-state-service";

describe("Learning State & Diagnostic Flow (§13, §18, §19, §36)", () => {
  let stateService: LearningStateService;
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    stateService = new LearningStateService();
  });

  describe("End-to-End Goal & Diagnostic Execution", () => {
    it("completes full diagnostic, records append-only evidence, and computes initial learning state", async () => {
      // 1. User creates goal
      const { goal, profile } = await stateService.createGoal(userA, {
        rawObjective: "I want to become a junior Python developer.",
        selectedDomainId: "python-junior",
        selfReportedLevel: "Beginner",
      });

      expect(goal.userId).toBe(userA);
      expect(profile.domainId).toBe("python-junior");
      expect(profile.mapVersionId).toBe("1.0.0");

      // 2. Start diagnostic session
      const { session, items } = await stateService.startDiagnostic(userA, goal.id);
      expect(session.status).toBe("IN_PROGRESS");
      expect(session.mapVersion).toBe("1.0.0");
      expect(items.length).toBeGreaterThanOrEqual(7);

      // 3. Submit responses for all items
      for (const item of items) {
        await stateService.submitDiagnosticAnswer(
          userA,
          session.id,
          item.id,
          item.correctAnswer
        );
      }

      // 4. Complete diagnostic
      const report = await stateService.completeDiagnostic(userA, session.id);
      expect(report.overallBaselineScore).toBe(100);
      expect(report.competencyBaselines.length).toBeGreaterThanOrEqual(7);

      // 5. Query learning state
      const learningState = await stateService.getCurrentLearningState(userA, goal.id);
      expect(learningState.diagnosticCompleted).toBe(true);
      expect(learningState.overallBaselineScore).toBe(100);
      expect(learningState.competencies.length).toBeGreaterThanOrEqual(7);

      // 6. Verify evidence was appended
      const evidence = await stateService.getDiagnosticEvidence(userA, goal.id);
      expect(evidence.length).toBe(items.length);
      for (const ev of evidence) {
        expect(ev.evidenceType).toBe("DIAGNOSTIC");
        expect(ev.learnerId).toBe(userA);
        expect(ev.metadata.mapVersion).toBe("1.0.0");
      }
    });

    it("refuses to complete diagnostic if items remain unanswered (§23)", async () => {
      const { goal } = await stateService.createGoal(userA, {
        rawObjective: "Learn Excel formulas.",
        selectedDomainId: "excel-pro",
      });

      const { session, items } = await stateService.startDiagnostic(userA, goal.id);

      // Answer only the first item
      await stateService.submitDiagnosticAnswer(
        userA,
        session.id,
        items[0].id,
        items[0].correctAnswer
      );

      // Attempt to complete incomplete session
      await expect(
        stateService.completeDiagnostic(userA, session.id)
      ).rejects.toThrow(/Cannot complete diagnostic.*Incomplete sessions cannot form baseline/);
    });
  });

  describe("MANDATORY SECURITY TEST: Cross-User Access Denial (§36, §42)", () => {
    it("strictly denies User B from reading, answering, or completing User A's diagnostic resources", async () => {
      // User A creates goal and starts diagnostic
      const { goal } = await stateService.createGoal(userA, {
        rawObjective: "Prepare mathematics exam",
        selectedDomainId: "math-exams",
      });

      const { session, items } = await stateService.startDiagnostic(userA, goal.id);

      // 1. User B attempts to read User A's goal -> DENIED
      await expect(stateService.getGoal(userB, goal.id)).rejects.toThrow(
        UnauthorizedAccessError
      );

      // 2. User B attempts to submit an answer to User A's session -> DENIED
      await expect(
        stateService.submitDiagnosticAnswer(userB, session.id, items[0].id, "15")
      ).rejects.toThrow(UnauthorizedAccessError);

      // 3. User B attempts to complete User A's session -> DENIED
      await expect(
        stateService.completeDiagnostic(userB, session.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // 4. User B attempts to read User A's learning state -> DENIED
      await expect(
        stateService.getCurrentLearningState(userB, goal.id)
      ).rejects.toThrow(UnauthorizedAccessError);
    });
  });

  describe("MANDATORY HISTORICAL MAP VERSION TEST (§25, §43)", () => {
    it("preserves V1 map version on historical diagnostic session and evidence", async () => {
      const { goal } = await stateService.createGoal(userA, {
        rawObjective: "Learn Python basics",
        selectedDomainId: "python-junior",
      });

      const { session, items } = await stateService.startDiagnostic(userA, goal.id);
      expect(session.mapVersion).toBe("1.0.0");

      for (const item of items) {
        await stateService.submitDiagnosticAnswer(userA, session.id, item.id, item.correctAnswer);
      }
      await stateService.completeDiagnostic(userA, session.id);

      const evidence = await stateService.getDiagnosticEvidence(userA, goal.id);
      expect(evidence.length).toBeGreaterThan(0);
      for (const ev of evidence) {
        expect(ev.metadata.mapVersion).toBe("1.0.0");
      }
    });
  });

  describe("MANDATORY BASELINE PRESERVATION TEST (§19, §44)", () => {
    it("preserves original baseline_score when later learning evidence is recorded", async () => {
      const { goal } = await stateService.createGoal(userA, {
        rawObjective: "Excel spreadsheets",
        selectedDomainId: "excel-pro",
      });

      const { session, items } = await stateService.startDiagnostic(userA, goal.id);

      // Submit specific answers (some correct, some incorrect)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const answer = i % 2 === 0 ? item.correctAnswer : "WRONG_ANSWER";
        await stateService.submitDiagnosticAnswer(userA, session.id, item.id, answer);
      }
      await stateService.completeDiagnostic(userA, session.id);

      // Retrieve initial baseline state for a tested competency
      const targetCompetencyId = items[0].competencyId;
      const initialBaseline = await stateService.getCompetencyBaseline(
        userA,
        goal.id,
        targetCompetencyId
      );
      expect(initialBaseline).not.toBeNull();
      const originalBaselineScore = initialBaseline!.baselineScore;

      // Simulate later learning practice evidence (S4/S5 simulation)
      await stateService.recordLaterLearningEvidence(
        userA,
        goal.id,
        targetCompetencyId,
        98.0
      );

      // Verify that baseline_score REMAINS EXACTLY originalBaselineScore (§44)
      const afterBaseline = await stateService.getCompetencyBaseline(
        userA,
        goal.id,
        targetCompetencyId
      );
      expect(afterBaseline!.baselineScore).toBe(originalBaselineScore);
    });
  });
});
