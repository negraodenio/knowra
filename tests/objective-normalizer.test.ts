import { describe, it, expect } from "vitest";
import { normalizeObjective } from "@/lib/learning/objective-normalizer";

describe("Objective Normalization Engine (§5, §6)", () => {
  it("normalizes a valid natural language goal into structured objective", async () => {
    const result = await normalizeObjective({
      rawObjective: "I want to become a junior Python developer for web backend.",
      selectedDomainId: "python-junior",
      targetOutcome: "Junior Python Developer",
      selfReportedLevel: "Beginner",
    });

    expect(result.normalized.domainId).toBe("python-junior");
    expect(result.normalized.targetOutcome).toBe("Junior Python Developer");
    expect(result.normalized.level).toBe("BEGINNER");
    expect(result.normalized.scope).toBe("COMPREHENSIVE");
    expect(result.normalized.clarificationNeeded).toBe(false);
  });

  it("throws error when user attempts to provide an invalid domain outside curriculum (§24)", async () => {
    await expect(
      normalizeObjective({
        rawObjective: "Learn biology",
        selectedDomainId: "non-existent-domain",
      })
    ).rejects.toThrow(/Invalid domain ID 'non-existent-domain'/);
  });

  it("flags clarificationNeeded when goal is too ambiguous or short (§5)", async () => {
    const result = await normalizeObjective({
      rawObjective: "hi",
      selectedDomainId: "excel-pro",
    });

    expect(result.normalized.clarificationNeeded).toBe(true);
    expect(result.normalized.clarificationQuestion).toBeDefined();
  });

  it("classifies exam preparation objectives appropriately", async () => {
    const result = await normalizeObjective({
      rawObjective: "I need to prepare for my high school mathematics exam next month.",
      selectedDomainId: "math-exams",
      deadline: "2026-11-15",
    });

    expect(result.normalized.scope).toBe("EXAM_PREP");
    expect(result.normalized.deadline).toBe("2026-11-15");
  });
});
