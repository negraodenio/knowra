import { describe, it, expect } from "vitest";
import { Competency } from "@/lib/learning/types";
import {
  calculatePriorityScore,
  LearnerCompetencyState,
  DEFAULT_RECOMMENDATION_WEIGHTS,
} from "@/lib/learning/recommendations";
import { calculateNextBestAction } from "@/lib/learning/next-best-action";
import { LearningGap } from "@/lib/learning/gap-analysis";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";

describe("Recommendation Priority & Prerequisite Graph Impact (§15, §18, §43, §44, §61, §68)", () => {
  const compA: Competency = {
    id: "comp-A",
    domainId: "test-domain",
    title: "Foundation A",
    description: "Blocks downstream competencies",
    category: "CONCEPTUAL",
    prerequisites: [],
    difficulty: 1,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  const compB: Competency = {
    id: "comp-B",
    domainId: "test-domain",
    title: "Terminal Node B",
    description: "Blocks nothing downstream",
    category: "CONCEPTUAL",
    prerequisites: [],
    difficulty: 1,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  it("same mastery + different downstream impact -> higher downstream impact gets higher priority (§44, §61)", () => {
    const state: LearnerCompetencyState = {
      competencyId: "test",
      masteryScore: 50,
      confidenceScore: 0.6,
      evidenceCount: 2,
    };

    const objective = { domainId: "test-domain" };

    // compA blocks 5 downstream nodes
    const scoreA = calculatePriorityScore(
      compA,
      "PRACTICE",
      state,
      undefined,
      5, // downstreamCount = 5
      objective
    );

    // compB blocks 0 downstream nodes
    const scoreB = calculatePriorityScore(
      compB,
      "PRACTICE",
      state,
      undefined,
      0, // downstreamCount = 0
      objective
    );

    expect(scoreA.priority).toBeGreaterThan(scoreB.priority);
    expect(scoreA.breakdown.prereqComponent).toBe(DEFAULT_RECOMMENDATION_WEIGHTS.maxPrerequisiteImpactWeight);
    expect(scoreB.breakdown.prereqComponent).toBe(0);
  });

  it("same gap + different objective relevance -> more relevant competency gets higher priority (§20, §61)", () => {
    const gap: LearningGap = {
      id: "gap-1",
      userId: "u1",
      learningGoalId: "g1",
      competencyId: "comp-1",
      severity: "MEDIUM",
      masteryScore: 50,
      confidenceScore: 0.7,
      signals: [
        { type: "EXERCISE_FAILURE", description: "Failed", observedScore: 50 },
        { type: "PERSISTENT_LOW_MASTERY", description: "Low", observedScore: 50 },
      ],
      reason: "Gap detected",
      status: "OPEN",
      detectedAt: new Date().toISOString(),
      version: 1,
    };

    const state: LearnerCompetencyState = {
      competencyId: "test",
      masteryScore: 50,
      confidenceScore: 0.7,
      evidenceCount: 2,
    };

    // Objective explicitly focuses on Foundation A
    const objective = {
      domainId: "test-domain",
      targetOutcome: "Foundation A Mastery",
    };

    const scoreTarget = calculatePriorityScore(
      compA,
      "REMEDIATE",
      state,
      gap,
      1,
      objective
    );

    const scoreOther = calculatePriorityScore(
      compB,
      "REMEDIATE",
      state,
      gap,
      1,
      objective
    );

    expect(scoreTarget.priority).toBeGreaterThan(scoreOther.priority);
    expect(scoreTarget.breakdown.objectiveComponent).toBe(DEFAULT_RECOMMENDATION_WEIGHTS.objectiveMatchWeight);
  });

  it("PREREQUISITE GRAPH ENFORCEMENT: A -> B -> C: focuses on A, not C (§18, §68)", () => {
    // Chain: nodeA -> nodeB -> nodeC
    const chainCompetencies: Competency[] = [
      {
        id: "node-A",
        domainId: "test-domain",
        title: "Node A Foundations",
        description: "Root",
        category: "CONCEPTUAL",
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "node-B",
        domainId: "test-domain",
        title: "Node B Intermediate",
        description: "Depends on A",
        category: "PROCEDURAL",
        prerequisites: ["node-A"],
        difficulty: 2,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "node-C",
        domainId: "test-domain",
        title: "Node C Advanced",
        description: "Depends on B",
        category: "PROCEDURAL",
        prerequisites: ["node-B"],
        difficulty: 3,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
    ];

    const graph = new PrerequisiteGraph(chainCompetencies);

    // Initial learner state: A = 45%, B = 0%, C = 0%
    const states = new Map<string, LearnerCompetencyState>();
    states.set("node-A", {
      competencyId: "node-A",
      masteryScore: 45,
      confidenceScore: 0.5,
      evidenceCount: 1,
    });
    states.set("node-B", {
      competencyId: "node-B",
      masteryScore: 0,
      confidenceScore: 0,
      evidenceCount: 0,
    });
    states.set("node-C", {
      competencyId: "node-C",
      masteryScore: 0,
      confidenceScore: 0,
      evidenceCount: 0,
    });

    const context = {
      userId: "u1",
      learningGoalId: "g1",
      objective: { domainId: "test-domain" },
      competencyStates: states,
      gaps: new Map<string, LearningGap>(),
      prerequisiteGraph: graph,
      allCompetencies: chainCompetencies,
    };

    const decision = calculateNextBestAction(context);

    // The recommendation MUST focus on node-A, NOT node-C
    expect(decision.recommendation.competencyId).toBe("node-A");
    expect(decision.recommendation.competencyId).not.toBe("node-C");
    expect(decision.recommendation.competencyId).not.toBe("node-B");

    // Node B and C are strictly blocked by unmastered prerequisites
    const isBBlocked = graph.isBlockedByPrerequisite(
      "node-B",
      new Map([["node-A", { masteryScore: 45, confidenceScore: 0.5 }]])
    );
    expect(isBBlocked).toBe(true);
  });
});
