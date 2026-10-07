import { describe, it, expect, beforeEach } from "vitest";
import { feynmanService } from "@/lib/learning/state/feynman-service";
import { reviewService } from "@/lib/learning/state/review-service";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

describe("Sprint 6 Cross-User Isolation & Security Tests (§29, §32)", () => {
  const userA = "sec-user-A-1111-1111-1111-111111111111";
  const userB = "sec-user-B-2222-2222-2222-222222222222";
  let goalIdUserA: string;
  let goalIdUserB: string;

  beforeEach(async () => {
    const { goal: goalA } = await learningStateService.createGoal(userA, {
      rawObjective: "Learn Python Basics",
      selectedDomainId: "python-junior",
    });
    goalIdUserA = goalA.id;

    const { goal: goalB } = await learningStateService.createGoal(userB, {
      rawObjective: "Learn Python As Well",
      selectedDomainId: "python-junior",
    });
    goalIdUserB = goalB.id;
  });

  describe("Feynman Security", () => {
    it("User B cannot access or submit User A's Feynman session (§29)", async () => {
      const sessionA = await feynmanService.startSession(userA, goalIdUserA, "py-variables-types");

      // User B attempts to read session A
      await expect(
        feynmanService.getSession(userB, sessionA.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to submit explanation to session A
      await expect(
        feynmanService.submitExplanation(userB, sessionA.id, "Malicious attempt")
      ).rejects.toThrow(UnauthorizedAccessError);
    });
  });

  describe("Review & Scheduler Security", () => {
    it("User B cannot access or answer User A's review items (§29)", async () => {
      const itemA = await reviewService.ensureReviewItem(userA, goalIdUserA, "py-variables-types");

      // User B attempts to read item A
      await expect(
        reviewService.getReviewItem(userB, itemA.id)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to answer item A
      await expect(
        reviewService.answerReviewItem(userB, itemA.id, "GOOD", 90)
      ).rejects.toThrow(UnauthorizedAccessError);
    });

    it("User B cannot modify User A's review session (§29)", async () => {
      const itemA = await reviewService.ensureReviewItem(userA, goalIdUserA, "py-variables-types");
      const sessionA = await reviewService.startReviewSession(userA, goalIdUserA, 10);

      // User B attempts to submit answer to session A
      await expect(
        reviewService.submitSessionAnswer(userB, sessionA.id, itemA.id, "GOOD", 90)
      ).rejects.toThrow(UnauthorizedAccessError);
    });
  });
});
