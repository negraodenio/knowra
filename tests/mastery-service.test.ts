import { describe, it, expect, beforeEach } from "vitest";
import { masteryService } from "@/lib/learning/state/mastery-service";
import { learningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";

describe("Mastery Service Integration & Mandatory Auditing Tests (§4, §19, §46, §54, §55, §56)", () => {
  const userA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const userB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  let goalId: string;
  const targetCompId = "py-variables-types";

  beforeEach(async () => {
    // Set up goal and diagnostic for User A
    const { goal } = await learningStateService.createGoal(userA, {
      rawObjective: "Learn Python from scratch",
      selectedDomainId: "python-junior",
    });
    goalId = goal.id;

    const { session, items } = await learningStateService.startDiagnostic(userA, goalId);

    // Answer items (py-variables-types answered with 100)
    for (const item of items) {
      await learningStateService.submitDiagnosticAnswer(
        userA,
        session.id,
        item.id,
        item.correctAnswer
      );
    }

    await learningStateService.completeDiagnostic(userA, session.id);
  });

  describe("MANDATORY BASELINE IMMUTABILITY TEST (§4, §54)", () => {
    it("ensures baseline_score remains completely untouched after subsequent learning evidence and mastery recalculation", async () => {
      // 1. Verify initial baseline score is 100
      const baselineBefore = await learningStateService.getCompetencyBaseline(
        userA,
        goalId,
        targetCompId
      );
      expect(baselineBefore).not.toBeNull();
      expect(baselineBefore!.baselineScore).toBe(100);

      // 2. Add later exercise evidence with a different score (e.g. 50)
      await learningStateService.recordLaterLearningEvidence(
        userA,
        goalId,
        targetCompId,
        50
      );

      // 3. Recalculate mastery through the Mastery Engine
      const { masteryOutput } = await masteryService.recalculateCompetencyMastery(
        userA,
        goalId,
        targetCompId
      );

      // Current mastery should now reflect combined evidence
      expect(masteryOutput.masteryScore).not.toBe(100);

      // 4. VERIFY: baseline_score MUST REMAIN 100 (§4, §54)
      const baselineAfter = await learningStateService.getCompetencyBaseline(
        userA,
        goalId,
        targetCompId
      );
      expect(baselineAfter!.baselineScore).toBe(100);
    });
  });

  describe("MANDATORY HISTORICAL SNAPSHOTS TEST (§19, §55)", () => {
    it("preserves snapshot V1 unchanged when new evidence triggers snapshot V2", async () => {
      // 1. Initial calculation creates snapshot V1
      const { snapshot: snap1 } = await masteryService.recalculateCompetencyMastery(
        userA,
        goalId,
        targetCompId,
        "INITIAL_RECALCULATION"
      );

      const score1 = snap1.masteryScore;
      expect(snap1.calculationVersion).toBe("v1");

      // 2. Add new evidence
      await learningStateService.recordLaterLearningEvidence(
        userA,
        goalId,
        targetCompId,
        95
      );

      // 3. Second calculation creates snapshot V2
      const { snapshot: snap2 } = await masteryService.recalculateCompetencyMastery(
        userA,
        goalId,
        targetCompId,
        "POST_PRACTICE_RECALCULATION"
      );

      // 4. Retrieve historical snapshots list
      const snapshots = await masteryService.getSnapshots(userA, goalId, targetCompId);
      expect(snapshots.length).toBeGreaterThanOrEqual(2);

      const historicalSnap1 = snapshots.find((s) => s.id === snap1.id);
      const historicalSnap2 = snapshots.find((s) => s.id === snap2.id);

      expect(historicalSnap1).toBeDefined();
      expect(historicalSnap2).toBeDefined();

      // Snapshot 1 must be strictly immutable (§55)
      expect(historicalSnap1!.masteryScore).toBe(score1);
      expect(historicalSnap1!.snapshotReason).toBe("INITIAL_RECALCULATION");
      expect(historicalSnap2!.snapshotReason).toBe("POST_PRACTICE_RECALCULATION");
    });
  });

  describe("MANDATORY CROSS-USER SECURITY TEST (§46, §56)", () => {
    it("strictly forbids User B from recalculating, viewing snapshots, or reading gaps belonging to User A", async () => {
      // User B attempts to recalculate User A's mastery -> DENIED
      await expect(
        masteryService.recalculateCompetencyMastery(userB, goalId, targetCompId)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to read User A's mastery snapshots -> DENIED
      await expect(
        masteryService.getSnapshots(userB, goalId, targetCompId)
      ).rejects.toThrow(UnauthorizedAccessError);

      // User B attempts to read User A's learning gaps -> DENIED
      await expect(
        masteryService.getGaps(userB, goalId)
      ).rejects.toThrow(UnauthorizedAccessError);
    });
  });
});
