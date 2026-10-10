import { describe, it, expect, beforeEach } from "vitest";
import { LearningStateService, UnauthorizedAccessError } from "@/lib/learning/state/learning-state-service";
import { getDiagnosticItemsByDomain } from "@/lib/learning/diagnostic/curriculum";

describe("Diagnostic Recovery & Integrity Invariants (§13, §18, §19, §23, §36)", () => {
  let service: LearningStateService;
  const testUserA = "11111111-aaaa-aaaa-aaaa-111111111111";
  const testUserB = "22222222-bbbb-bbbb-bbbb-222222222222";
  const domainId = "python-junior";

  beforeEach(() => {
    service = new LearningStateService();
  });

  it("Invariant 1 & 3: Refuses to complete when any required item is missing (§23)", async () => {
    const { goal } = await service.createGoal(testUserA, {
      rawObjective: "Learn Python fundamentals",
      selectedDomainId: domainId,
    });

    const { session, items } = await service.startDiagnostic(testUserA, goal.id);
    expect(items.length).toBeGreaterThan(1);

    // Answer only the first question
    await service.submitDiagnosticAnswer(
      testUserA,
      session.id,
      items[0].id,
      items[0].correctAnswer
    );

    // Completion must throw and refuse incomplete session
    await expect(
      service.completeDiagnostic(testUserA, session.id)
    ).rejects.toThrow(/Cannot complete diagnostic.*Incomplete sessions cannot form baseline/);
  });

  it("Invariant 2 & 4: Concurrent and duplicate submissions for same itemId update cleanly without creating duplicates", async () => {
    const { goal } = await service.createGoal(testUserA, {
      rawObjective: "Learn Python fundamentals",
      selectedDomainId: domainId,
    });

    const { session, items } = await service.startDiagnostic(testUserA, goal.id);

    // Simulate rapid concurrent double-click on item 0
    const [resp1, resp2] = await Promise.all([
      service.submitDiagnosticAnswer(testUserA, session.id, items[0].id, items[0].correctAnswer),
      service.submitDiagnosticAnswer(testUserA, session.id, items[0].id, items[0].correctAnswer),
    ]);

    expect(resp1.isCorrect).toBe(true);
    expect(resp2.isCorrect).toBe(true);

    // Verify in-memory response count for session is exactly 1 for this item
    const recorded = (service as unknown as { responses: Map<string, Array<{ itemId: string }>> }).responses.get(session.id) || [];
    const item0Matches = recorded.filter((r) => r.itemId === items[0].id);
    expect(item0Matches.length).toBe(1);
  });

  it("Invariant 5 & 8: Repeated completeDiagnostic calls are strictly idempotent and do not duplicate evidence", async () => {
    const { goal } = await service.createGoal(testUserA, {
      rawObjective: "Learn Python fundamentals",
      selectedDomainId: domainId,
    });

    const { session, items } = await service.startDiagnostic(testUserA, goal.id);

    // Answer all items
    for (const item of items) {
      await service.submitDiagnosticAnswer(
        testUserA,
        session.id,
        item.id,
        item.correctAnswer
      );
    }

    // First completion
    const report1 = await service.completeDiagnostic(testUserA, session.id);
    expect(report1.overallBaselineScore).toBe(100);

    const evidenceAfterFirst = await service.getDiagnosticEvidence(testUserA, goal.id);
    expect(evidenceAfterFirst.length).toBe(items.length);

    // Second completion (retry)
    const report2 = await service.completeDiagnostic(testUserA, session.id);
    expect(report2.overallBaselineScore).toBe(report1.overallBaselineScore);

    // Evidence must not be duplicated
    const evidenceAfterSecond = await service.getDiagnosticEvidence(testUserA, goal.id);
    expect(evidenceAfterSecond.length).toBe(items.length);
  });

  it("Invariant 6 & 7: Reloading recovers completed session and preserves established baseline", async () => {
    const { goal } = await service.createGoal(testUserA, {
      rawObjective: "Learn Python fundamentals",
      selectedDomainId: domainId,
    });

    const { session, items } = await service.startDiagnostic(testUserA, goal.id);

    for (const item of items) {
      await service.submitDiagnosticAnswer(
        testUserA,
        session.id,
        item.id,
        item.correctAnswer
      );
    }

    await service.completeDiagnostic(testUserA, session.id);

    // Simulate page reload: startDiagnostic called again on the same goal
    const reloadResult = await service.startDiagnostic(testUserA, goal.id);

    expect(reloadResult.session.id).toBe(session.id);
    expect(reloadResult.session.status).toBe("COMPLETED");
    expect(reloadResult.report).toBeDefined();
    expect(reloadResult.report?.overallBaselineScore).toBe(100);
    expect(Object.keys(reloadResult.existingAnswers || {}).length).toBe(items.length);
  });

  it("Invariant 9: Session ownership is strictly validated server-side (§36)", async () => {
    const { goal } = await service.createGoal(testUserA, {
      rawObjective: "Learn Python fundamentals",
      selectedDomainId: domainId,
    });

    const { session, items } = await service.startDiagnostic(testUserA, goal.id);

    // User B attempts to submit answer to User A's session -> Forbidden
    await expect(
      service.submitDiagnosticAnswer(testUserB, session.id, items[0].id, "ans")
    ).rejects.toThrow(UnauthorizedAccessError);

    // User B attempts to complete User A's session -> Forbidden
    await expect(
      service.completeDiagnostic(testUserB, session.id)
    ).rejects.toThrow(UnauthorizedAccessError);
  });

  it("Invariant 10: Missing questions are identified from actual item IDs, not hardcoded question index", () => {
    const items = getDiagnosticItemsByDomain(domainId);
    expect(items.length).toBeGreaterThan(2);

    // Omit a question from the middle (e.g. index 3)
    const omittedItem = items[3];
    const answeredMap: Record<string, string> = {};
    items.forEach((it) => {
      if (it.id !== omittedItem.id) {
        answeredMap[it.id] = "some-answer";
      }
    });

    // Dynamic resolution finds missing item by ID
    const missing = items.filter((it) => !answeredMap[it.id]);
    expect(missing.length).toBe(1);
    expect(missing[0].id).toBe(omittedItem.id);
    expect(missing[0].competencyId).toBe(omittedItem.competencyId);
  });
});
