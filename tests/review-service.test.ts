import { describe, it, expect, beforeEach } from "vitest";
import { reviewService } from "@/lib/learning/state/review-service";
import { learningStateService } from "@/lib/learning/state/learning-state-service";

describe("Review Service & Spaced Repetition Integration (§11–19, §30, §32)", () => {
  const userId = "review-test-user-1";
  let goalId: string;
  const baseDate = new Date("2026-10-01T12:00:00Z");

  beforeEach(async () => {
    const { goal } = await learningStateService.createGoal(userId, {
      rawObjective: "Master Excel Formulas",
      selectedDomainId: "excel-pro",
    });
    goalId = goal.id;
  });

  it("registers review item and detects due status accurately", async () => {
    const item = await reviewService.ensureReviewItem(
      userId,
      goalId,
      "xl-lookup-functions",

      "FSRS",
      baseDate
    );

    expect(item.competencyId).toBe("xl-lookup-functions");
    expect(item.schedulerType).toBe("FSRS");
    expect(item.reviewCount).toBe(0);

    // Queue at baseDate should include the item since initial dueDate is baseDate
    const queue = await reviewService.getReviewQueue(userId, goalId, 10, baseDate);
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe(item.id);
  });

  it("prioritizes overdue items in review queue (§16)", async () => {
    // Item 1: Due on Oct 1
    const item1 = await reviewService.ensureReviewItem(
      userId,
      goalId,
      "xl-lookup-functions",

      "FSRS",
      baseDate
    );

    // Item 2: Due on Oct 5 (less overdue than item 1 on Oct 10)
    const oct5 = new Date("2026-10-05T12:00:00Z");
    const item2 = await reviewService.ensureReviewItem(
      userId,
      goalId,
      "xl-conditional-math",
      "FSRS",
      oct5
    );

    // On Oct 10, both are due, but item 1 is more overdue (9 days vs 5 days)
    const oct10 = new Date("2026-10-10T12:00:00Z");
    const queue = await reviewService.getReviewQueue(userId, goalId, 10, oct10);

    expect(queue.length).toBe(2);
    expect(queue[0].id).toBe(item1.id); // More overdue item first
    expect(queue[1].id).toBe(item2.id);
  });

  it("answers review item, advances scheduler, and records REVIEW evidence (§14, §17)", async () => {
    const item = await reviewService.ensureReviewItem(
      userId,
      goalId,
      "xl-lookup-functions",

      "FSRS",
      baseDate
    );

    const result = await reviewService.answerReviewItem(
      userId,
      item.id,
      "GOOD",
      85,
      baseDate
    );

    expect(result.reviewItem.reviewCount).toBe(1);
    expect(result.schedulingResult.intervalDays).toBeGreaterThanOrEqual(1);

    // Verify append-only REVIEW evidence was generated
    const allEvidence = await learningStateService.getAllEvidence(userId, goalId);
    const reviewEv = allEvidence.find((e) => e.evidenceType === "REVIEW");
    expect(reviewEv).toBeDefined();
    expect(reviewEv?.score).toBe(85);

    // Verify mastery recalculation output returned
    expect(result.masteryOutput).toBeDefined();
  });

  it("IDEMPOTENCY GUARD: duplicate immediate submission protects against double-advancing (§30)", async () => {
    const item = await reviewService.ensureReviewItem(
      userId,
      goalId,
      "xl-lookup-functions",

      "FSRS",
      baseDate
    );

    // First answer
    const res1 = await reviewService.answerReviewItem(
      userId,
      item.id,
      "GOOD",
      85,
      baseDate
    );
    expect(res1.reviewItem.reviewCount).toBe(1);
    const firstInterval = res1.schedulingResult.intervalDays;

    // Immediate duplicate replay (within 1 second)
    const duplicateDate = new Date(baseDate.getTime() + 500);
    const res2 = await reviewService.answerReviewItem(
      userId,
      item.id,
      "GOOD",
      85,
      duplicateDate
    );

    // Reps/reviewCount must NOT advance twice
    expect(res2.reviewItem.reviewCount).toBe(1);
    expect(res2.schedulingResult.intervalDays).toBe(firstInterval);
  });

  it("manages Review Sessions through STARTED -> COMPLETED lifecycle (§15)", async () => {
    await reviewService.ensureReviewItem(userId, goalId, "xl-lookup-functions", "FSRS", baseDate);

    const session = await reviewService.startReviewSession(userId, goalId, 10, baseDate);
    expect(session.status).toBe("STARTED");
    expect(session.itemCount).toBe(1);
    expect(session.completedCount).toBe(0);

    const subResult = await reviewService.submitSessionAnswer(
      userId,
      session.id,
      session.itemIds[0],
      "GOOD",
      90,
      baseDate
    );

    expect(subResult.session.completedCount).toBe(1);
    expect(subResult.session.status).toBe("COMPLETED");
  });
});
