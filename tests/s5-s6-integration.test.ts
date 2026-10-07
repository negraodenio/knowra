import { describe, it, expect } from "vitest";
import { Competency } from "@/lib/learning/types";
import { evaluateActionForCompetency, LearnerCompetencyState } from "@/lib/learning/recommendations";
import { calculateNextBestAction } from "@/lib/learning/next-best-action";
import { LearningGap } from "@/lib/learning/gap-analysis";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";

describe("S5–S6 Adaptive Recommendation Integration (§20, §21, §22, §32)", () => {
  const compConceptual: Competency = {
    id: "comp-concept",
    domainId: "test-domain",
    title: "Python Functions Concept",
    description: "Scope and parameters",
    category: "CONCEPTUAL",
    prerequisites: [],
    difficulty: 2,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  const compProcedural: Competency = {
    id: "comp-proc",
    domainId: "test-domain",
    title: "Excel Formulas Execution",
    description: "Formulas and operations",
    category: "PROCEDURAL",
    prerequisites: [],
    difficulty: 2,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  it("CASE A: Mastery 45 + open critical gap + review due -> REMEDIATE outranks REVIEW (§21)", () => {
    const state: LearnerCompetencyState = {
      competencyId: compConceptual.id,
      masteryScore: 45,
      confidenceScore: 0.8,
      evidenceCount: 3,
    };

    const gap: LearningGap = {
      id: "gap-crit",
      userId: "u1",
      learningGoalId: "g1",
      competencyId: compConceptual.id,
      severity: "CRITICAL",
      masteryScore: 45,
      confidenceScore: 0.8,
      signals: [
        { type: "EXERCISE_FAILURE", description: "Fail 1", observedScore: 40 },
        { type: "PERSISTENT_LOW_MASTERY", description: "Fail 2", observedScore: 45 },
      ],
      reason: "Critical gap",
      status: "OPEN",
      detectedAt: new Date().toISOString(),
      version: 1,
    };

    const reviewInfo = { isDue: true, retrievability: 0.70 };

    const result = evaluateActionForCompetency(
      compConceptual,
      state,
      gap,
      2,
      new Date(),
      undefined,
      reviewInfo
    );

    // Open gap MUST outrank scheduled review!
    expect(result.action).toBe("REMEDIATE");
    expect(result.action).not.toBe("REVIEW");
    expect(result.reason).toContain("open CRITICAL gap");
  });

  it("CASE B: Mastery 75 + confidence 80 + review due -> REVIEW (§21)", () => {
    const state: LearnerCompetencyState = {
      competencyId: compConceptual.id,
      masteryScore: 75,
      confidenceScore: 0.80,
      evidenceCount: 4,
    };

    const reviewInfo = { isDue: true, retrievability: 0.65 };

    const result = evaluateActionForCompetency(
      compConceptual,
      state,
      undefined,
      1,
      new Date(),
      undefined,
      reviewInfo
    );

    expect(result.action).toBe("REVIEW");
    expect(result.reason).toContain("due for spaced repetition review");
  });

  it("CASE C: Mastery 85 + confidence 90 + review NOT due -> ADVANCE (do not force review) (§21)", () => {
    const state: LearnerCompetencyState = {
      competencyId: compConceptual.id,
      masteryScore: 85,
      confidenceScore: 0.90,
      evidenceCount: 5,
    };

    const reviewInfo = { isDue: false, retrievability: 0.95 };

    const result = evaluateActionForCompetency(
      compConceptual,
      state,
      undefined,
      1,
      new Date(),
      undefined,
      reviewInfo
    );

    expect(result.action).toBe("ADVANCE");
    expect(result.action).not.toBe("REVIEW");
  });

  it("CASE D: Mastery 65 + confidence 60 + review due -> REVIEW (§21)", () => {
    const state: LearnerCompetencyState = {
      competencyId: compProcedural.id,
      masteryScore: 65,
      confidenceScore: 0.60,
      evidenceCount: 3,
    };

    const reviewInfo = { isDue: true, retrievability: 0.50 };

    const result = evaluateActionForCompetency(
      compProcedural,
      state,
      undefined,
      0,
      new Date(),
      undefined,
      reviewInfo
    );

    expect(result.action).toBe("REVIEW");
  });

  it("CASE E: Prerequisite blocked + downstream review due -> prerequisite blocking takes precedence (§21)", () => {
    const chain: Competency[] = [
      {
        id: "root-prereq",
        domainId: "test-domain",
        title: "Root Prereq",
        description: "Root",
        category: "CONCEPTUAL",
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "downstream-node",
        domainId: "test-domain",
        title: "Downstream Node",
        description: "Blocked by root",
        category: "PROCEDURAL",
        prerequisites: ["root-prereq"],
        difficulty: 2,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
    ];

    const graph = new PrerequisiteGraph(chain);

    // root-prereq is weak (mastery = 40)
    const states = new Map<string, LearnerCompetencyState>();
    states.set("root-prereq", {
      competencyId: "root-prereq",
      masteryScore: 40,
      confidenceScore: 0.5,
      evidenceCount: 1,
    });
    states.set("downstream-node", {
      competencyId: "downstream-node",
      masteryScore: 70,
      confidenceScore: 0.7,
      evidenceCount: 2,
    });

    // downstream-node has a review due
    const dueReviews = new Map();
    dueReviews.set("downstream-node", { isDue: true, retrievability: 0.60, dueAt: new Date().toISOString() });

    const context = {
      userId: "u1",
      learningGoalId: "g1",
      objective: { domainId: "test-domain" },
      competencyStates: states,
      gaps: new Map<string, LearningGap>(),
      prerequisiteGraph: graph,
      allCompetencies: chain,
      dueReviewItems: dueReviews,
    };

    const decision = calculateNextBestAction(context);

    // Prerequisite DAG prevents recommending downstream-node!
    expect(decision.recommendation.competencyId).toBe("root-prereq");
    expect(decision.recommendation.competencyId).not.toBe("downstream-node");
  });

  it("CATEGORY AFFINITY: Conceptual -> FEYNMAN; Procedural -> PRACTICE (§22)", () => {
    // Conceptual with developing mastery
    const stateConc: LearnerCompetencyState = {
      competencyId: compConceptual.id,
      masteryScore: 68,
      confidenceScore: 0.60,
      evidenceCount: 2,
    };
    const resConc = evaluateActionForCompetency(compConceptual, stateConc, undefined, 0);
    expect(resConc.action).toBe("FEYNMAN");

    // Procedural with developing mastery
    const stateProc: LearnerCompetencyState = {
      competencyId: compProcedural.id,
      masteryScore: 68,
      confidenceScore: 0.60,
      evidenceCount: 2,
    };
    const resProc = evaluateActionForCompetency(compProcedural, stateProc, undefined, 0);
    expect(resProc.action).toBe("PRACTICE");
    expect(resProc.action).not.toBe("FEYNMAN");
  });
});
