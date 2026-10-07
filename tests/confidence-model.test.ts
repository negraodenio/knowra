import { describe, it, expect } from "vitest";
import { calculateEvidenceConfidence } from "@/lib/learning/mastery";
import { EvidenceRecord } from "@/lib/learning/types";

describe("Evidence Confidence Model (§12, §13, §14, §15, §40, §51)", () => {
  const learnerId = "user-1";
  const now = new Date("2026-10-07T12:00:00Z");

  it("enforces hard ceiling of 0.40 for a single observation (§15)", () => {
    const single: EvidenceRecord[] = [
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 100,
        confidence: 0.9,
        source: "test",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const conf = calculateEvidenceConfidence(single, now);
    expect(conf).toBeLessThanOrEqual(0.40);
  });

  it("enforces ceiling of 0.65 for two consistent observations (§15)", () => {
    const twoConsistent: EvidenceRecord[] = [
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "DIAGNOSTIC",
        result: "SUCCESS",
        score: 95,
        confidence: 0.5,
        source: "diag",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 90,
        confidence: 0.8,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const conf = calculateEvidenceConfidence(twoConsistent, now);
    expect(conf).toBeGreaterThan(0.40);
    expect(conf).toBeLessThanOrEqual(0.65);
  });

  it("penalizes confidence when observations are conflicting (§14)", () => {
    const conflicting: EvidenceRecord[] = [
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 95,
        confidence: 0.8,
        source: "ex1",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "FAILURE",
        score: 20,
        confidence: 0.8,
        source: "ex2",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const conf = calculateEvidenceConfidence(conflicting, now);
    expect(conf).toBeLessThan(0.45);
  });

  it("rewards multiple observations across diverse types with high confidence (§40)", () => {
    const diverseConsistent: EvidenceRecord[] = [
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "DIAGNOSTIC",
        result: "SUCCESS",
        score: 90,
        confidence: 0.5,
        source: "diag",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 88,
        confidence: 0.8,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "APPLICATION",
        result: "SUCCESS",
        score: 92,
        confidence: 0.85,
        source: "app",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "REVIEW",
        result: "SUCCESS",
        score: 95,
        confidence: 0.9,
        source: "rev",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const conf = calculateEvidenceConfidence(diverseConsistent, now);
    expect(conf).toBeGreaterThanOrEqual(0.80);
  });

  it("decays confidence when evidence is old (§11, §51)", () => {
    const veryOldDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000); // 120 days ago

    const oldEvidence: EvidenceRecord[] = [
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 90,
        confidence: 0.8,
        source: "ex1",
        timestamp: veryOldDate.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId,
        competencyId: "py-cond",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 85,
        confidence: 0.8,
        source: "ex2",
        timestamp: veryOldDate.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const conf = calculateEvidenceConfidence(oldEvidence, now);
    expect(conf).toBeLessThan(0.30);
  });
});
