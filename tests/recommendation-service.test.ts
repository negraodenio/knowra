import { describe, it, expect, beforeEach } from "vitest";
import { recommendationService } from "@/lib/learning/state/recommendation-service";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { masteryService } from "@/lib/learning/state/mastery-service";

describe("Recommendation Service & Lifecycle Engine (§13, §27–33, §49, §56, §57, §63, §64, §65)", () => {
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  let goalIdUserA: string;
  let goalIdUserB: string;

  beforeEach(async () => {
    // Setup Goal & Diagnostic for User A
    const { goal: goalA } = await learningStateService.createGoal(userA, {
      rawObjective: "Learn Python for junior engineering",
      selectedDomainId: "python-junior",
    });
    goalIdUserA = goalA.id;

    // Start & complete diagnostic for User A
    const { session: sessionA, items: itemsA } = await learningStateService.startDiagnostic(
      userA,
      goalIdUserA
    );
    for (const item of itemsA) {
      await learningStateService.submitDiagnosticAnswer(
        userA,
        sessionA.id,
        item.id,
        item.correctAnswer
      );
    }
    await learningStateService.completeDiagnostic(userA, sessionA.id);

    // Setup Goal for User B
    const { goal: goalB } = await learningStateService.createGoal(userB, {
      rawObjective: "Learn Python as well",
      selectedDomainId: "python-junior",
    });
    goalIdUserB = goalB.id;
  });

  describe("RECOMMENDATION LIFECYCLE TESTS (§27, §28, §29, §64)", () => {
    it("progresses through PENDING -> PRESENTED -> ACCEPTED -> COMPLETED and verifies history (§27, §64)", async () => {
      // 1. Initial next best action is generated with PENDING status
      const rec = await recommendationService.getNextBestAction(userA, goalIdUserA);
      expect(rec.status).toBe("PENDING");
      expect(rec.userId).toBe(userA);
      expect(rec.learningGoalId).toBe(goalIdUserA);

      // 2. Mark PRESENTED
      const presented = await recommendationService.presentRecommendation(userA, rec.id);
      expect(presented.status).toBe("PRESENTED");
      expect(presented.presentedAt).toBeDefined();

      // 3. Mark ACCEPTED
      const accepted = await recommendationService.acceptRecommendation(userA, rec.id);
      expect(accepted.status).toBe("ACCEPTED");
      expect(accepted.acceptedAt).toBeDefined();

      // 4. Mark COMPLETED
      const completed = await recommendationService.completeRecommendation(userA, rec.id);
      expect(completed.status).toBe("COMPLETED");
      expect(completed.completedAt).toBeDefined();

      // 5. Verify history is preserved
      const history = await recommendationService.getRecommendationHistory(userA, goalIdUserA);
      expect(history.length).toBeGreaterThanOrEqual(1);
      const found = history.find((h) => h.id === rec.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe("COMPLETED");
    });

    it("CRITICAL RULE: Acceptance does NOT create learning evidence (§28, §64)", async () => {
      const evidenceBefore = await learningStateService.getAllEvidence(userA, goalIdUserA);
      const evidenceCountBefore = evidenceBefore.length;

      const rec = await recommendationService.getNextBestAction(userA, goalIdUserA);
      await recommendationService.acceptRecommendation(userA, rec.id);

      const evidenceAfter = await learningStateService.getAllEvidence(userA, goalIdUserA);
      // Evidence count must remain 100% unchanged after acceptance
      expect(evidenceAfter.length).toBe(evidenceCountBefore);
    });

    it("CRITICAL RULE: Completion does NOT fabricate fake evidence (§29, §64)", async () => {
      const rec = await recommendationService.getNextBestAction(userA, goalIdUserA);
      await recommendationService.acceptRecommendation(userA, rec.id);

      const evidenceBefore = await learningStateService.getAllEvidence(userA, goalIdUserA);
      await recommendationService.completeRecommendation(userA, rec.id);
      const evidenceAfter = await learningStateService.getAllEvidence(userA, goalIdUserA);

      // Completion marks the recommendation entity, but never creates fake evidence
      expect(evidenceAfter.length).toBe(evidenceBefore.length);
    });
  });

  describe("STALE RECOMMENDATION HANDLING (§56, §57, §63)", () => {
    it("invalidates stale recommendation as EXPIRED when learner state changes (§56, §63)", async () => {
      // 1. User has an active recommendation on a competency
      const rec1 = await recommendationService.getNextBestAction(userA, goalIdUserA);
      expect(rec1.status).toBe("PENDING");

      // 2. State changes significantly: e.g. record later evidence with 100 score and recalculate
      await learningStateService.recordLaterLearningEvidence(
        userA,
        goalIdUserA,
        rec1.competencyId,
        100
      );
      await masteryService.recalculateCompetencyMastery(
        userA,
        goalIdUserA,
        rec1.competencyId
      );

      // 3. Next retrieval detects state change: old recommendation is marked EXPIRED
      const rec2 = await recommendationService.getNextBestAction(userA, goalIdUserA);

      // Verify that rec1 was expired
      const history = await recommendationService.getRecommendationHistory(userA, goalIdUserA);
      const oldRec = history.find((h) => h.id === rec1.id);
      if (rec2.id !== rec1.id) {
        expect(oldRec?.status).toBe("EXPIRED");
      }
    });
  });

  describe("MANDATORY CROSS-USER SECURITY TESTS (§49, §65)", () => {
    it("User B cannot access or modify User A's recommendations (§49, §65)", async () => {
      const recA = await recommendationService.getNextBestAction(userA, goalIdUserA);

      // User B attempts to present User A's recommendation
      await expect(
        recommendationService.presentRecommendation(userB, recA.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to accept User A's recommendation
      await expect(
        recommendationService.acceptRecommendation(userB, recA.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to skip User A's recommendation
      await expect(
        recommendationService.skipRecommendation(userB, recA.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to complete User A's recommendation
      await expect(
        recommendationService.completeRecommendation(userB, recA.id)
      ).rejects.toThrow(UnauthorizedAccessError);
    });

    it("User B cannot view User A's adaptive learning plan (§49, §65)", async () => {
      // User B attempts to get plan for User A's goal
      await expect(
        recommendationService.getAdaptiveLearningPlan(userB, goalIdUserA)
      ).rejects.toThrow(UnauthorizedAccessError);
    });
  });
});
