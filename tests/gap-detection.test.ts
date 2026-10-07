import { describe, it, expect } from "vitest";
import { evaluateLearningGap } from "@/lib/learning/gap-analysis";
import { calculateMastery } from "@/lib/learning/mastery";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";
import { EvidenceRecord, Competency } from "@/lib/learning/types";

describe("Deterministic Gap Detection Engine (§18, §22, §23, §26, §27, §28, §29, §52)", () => {
  const userId = "user-1";
  const goalId = "goal-1";
  const competencyId = "py-functions";
  const now = new Date("2026-10-07T12:00:00Z");

  // Sample competencies for prerequisite testing
  const sampleComps: Competency[] = [
    {
      id: "py-functions",
      domainId: "python-junior",
      title: "Functions",
      description: "Functions",
      category: "CONCEPTUAL",
      prerequisites: [],
      difficulty: 2,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "py-oop",
      domainId: "python-junior",
      title: "OOP",
      description: "OOP",
      category: "CONCEPTUAL",
      prerequisites: ["py-functions"],
      difficulty: 3,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "py-testing",
      domainId: "python-junior",
      title: "Testing",
      description: "Testing",
      category: "PROCEDURAL",
      prerequisites: ["py-functions"],
      difficulty: 3,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
  ];
  const prereqGraph = new PrerequisiteGraph(sampleComps);

  it("FALSE POSITIVE PROTECTION: does NOT create a gap from one isolated failure (§28)", () => {
    const singleFailure: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "FAILURE",
        score: 30,
        confidence: 0.4,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", singleFailure, { referenceDate: now });

    const gap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: singleFailure,
      prerequisiteGraph: prereqGraph,
    });

    // Must be null (0 gaps declared from single observation §28)
    expect(gap).toBeNull();
  });

  it("detects a gap when TWO independent negative signals exist: Diagnostic + Exercise (§22)", () => {
    const dualSignals: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "DIAGNOSTIC",
        result: "FAILURE",
        score: 40,
        confidence: 0.4,
        source: "diag",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "FAILURE",
        score: 35,
        confidence: 0.6,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", dualSignals, { referenceDate: now });

    const gap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: dualSignals,
      prerequisiteGraph: prereqGraph,
    });

    expect(gap).not.toBeNull();
    expect(gap!.status).toBe("OPEN");
    expect(gap!.signals.length).toBeGreaterThanOrEqual(2);
    // Severity is amplified because py-functions is a prerequisite for py-oop and py-testing (§26)
    expect(["CRITICAL", "HIGH"]).toContain(gap!.severity);
    expect(gap!.reason).toContain("Learning gap detected");
    expect(gap!.reason).toContain("independent signals");
  });

  it("detects a gap when Exercise failure and Review failure occur (§22, §52)", () => {
    const dualFailures: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "FAILURE",
        score: 45,
        confidence: 0.6,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId: userId,
        competencyId,
        evidenceType: "REVIEW",
        result: "FAILURE",
        score: 30,
        confidence: 0.6,
        source: "rev",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", dualFailures, { referenceDate: now });

    const gap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: dualFailures,
    });

    expect(gap).not.toBeNull();
    expect(gap!.status).toBe("OPEN");
    expect(gap!.signals.some((s) => s.type === "EXERCISE_FAILURE")).toBe(true);
    expect(gap!.signals.some((s) => s.type === "REVIEW_FAILURE")).toBe(true);
  });

  it("does NOT create a gap when mastery is solid (>= 75) (§52)", () => {
    const solidEvidence: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "DIAGNOSTIC",
        result: "SUCCESS",
        score: 80,
        confidence: 0.4,
        source: "diag",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 85,
        confidence: 0.7,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", solidEvidence, { referenceDate: now });

    const gap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: solidEvidence,
      prerequisiteGraph: prereqGraph,
    });

    expect(gap).toBeNull();
  });

  it("resolves an open gap when new evidence demonstrates sufficient mastery (>= 70) (§29)", () => {
    // Existing open gap
    const existingGap = {
      id: "gap-123",
      userId,
      learningGoalId: goalId,
      competencyId,
      severity: "HIGH" as const,
      masteryScore: 38,
      confidenceScore: 0.5,
      signals: [],
      reason: "Prior failure",
      status: "OPEN" as const,
      detectedAt: "2026-10-01T10:00:00Z",
      version: 1,
    };

    // Improved evidence bringing mastery to 80
    const improvedEvidence: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 85,
        confidence: 0.8,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId: userId,
        competencyId,
        evidenceType: "FEYNMAN",
        result: "SUCCESS",
        score: 80,
        confidence: 0.85,
        source: "feynman",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", improvedEvidence, { referenceDate: now });

    const resolvedGap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: improvedEvidence,
      existingGap,
    });

    expect(resolvedGap).not.toBeNull();
    expect(resolvedGap!.status).toBe("RESOLVED");
    expect(resolvedGap!.resolvedAt).toBeDefined();
    expect(resolvedGap!.version).toBe(2);
  });

  it("reopens a previously resolved gap if new evidence regresses below threshold (§30)", () => {
    // Existing resolved gap
    const resolvedGap = {
      id: "gap-123",
      userId,
      learningGoalId: goalId,
      competencyId,
      severity: "LOW" as const,
      masteryScore: 78,
      confidenceScore: 0.7,
      signals: [],
      reason: "Prior failure resolved",
      status: "RESOLVED" as const,
      detectedAt: "2026-10-01T10:00:00Z",
      resolvedAt: "2026-10-05T10:00:00Z",
      version: 2,
    };

    // Regression evidence
    const regressedEvidence: EvidenceRecord[] = [
      {
        learnerId: userId,
        competencyId,
        evidenceType: "DIAGNOSTIC",
        result: "FAILURE",
        score: 40,
        confidence: 0.4,
        source: "diag",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
      {
        learnerId: userId,
        competencyId,
        evidenceType: "EXERCISE",
        result: "FAILURE",
        score: 30,
        confidence: 0.7,
        source: "ex",
        timestamp: now.toISOString(),
        metadata: {},
        version: 1,
      },
    ];

    const masteryOutput = calculateMastery(competencyId, "CONCEPTUAL", regressedEvidence, { referenceDate: now });

    const reopenedGap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: "CONCEPTUAL",
      masteryOutput,
      evidenceList: regressedEvidence,
      existingGap: resolvedGap,
    });

    expect(reopenedGap).not.toBeNull();
    expect(reopenedGap!.status).toBe("OPEN");
    expect(reopenedGap!.resolvedAt).toBeUndefined();
    expect(reopenedGap!.version).toBe(3);
  });
});
