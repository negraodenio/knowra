import { describe, it, expect } from "vitest";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";
import { Competency } from "@/lib/learning/types";

describe("Prerequisite Graph Engine (§8, §50)", () => {
  const sampleCompetencies: Competency[] = [
    {
      id: "A",
      domainId: "test-domain",
      title: "Node A",
      description: "Root A",
      category: "CONCEPTUAL",
      prerequisites: [],
      difficulty: 1,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "B",
      domainId: "test-domain",
      title: "Node B",
      description: "Depends on A",
      category: "PROCEDURAL",
      prerequisites: ["A"],
      difficulty: 2,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "C",
      domainId: "test-domain",
      title: "Node C",
      description: "Depends on A",
      category: "CONCEPTUAL",
      prerequisites: ["A"],
      difficulty: 2,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "D",
      domainId: "test-domain",
      title: "Node D",
      description: "Depends on B and C (Diamond)",
      category: "PROCEDURAL",
      prerequisites: ["B", "C"],
      difficulty: 3,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
    {
      id: "E",
      domainId: "test-domain",
      title: "Node E",
      description: "Independent Root E",
      category: "FACTUAL",
      prerequisites: [],
      difficulty: 1,
      version: 1,
      status: "ACTIVE",
      provenance: "CURATED",
    },
  ];

  it("calculates direct prerequisites correctly", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    expect(graph.getDirectPrerequisites("A")).toEqual([]);
    expect(graph.getDirectPrerequisites("B")).toEqual(["A"]);
    expect(graph.getDirectPrerequisites("D").sort()).toEqual(["B", "C"].sort());
  });

  it("calculates transitive (upstream) prerequisites correctly", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    expect(graph.getAllPrerequisites("A")).toEqual([]);
    expect(graph.getAllPrerequisites("B")).toEqual(["A"]);
    // D depends on B, C which both depend on A => ancestors are A, B, C
    expect(graph.getAllPrerequisites("D").sort()).toEqual(["A", "B", "C"].sort());
  });

  it("calculates direct dependents correctly", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    expect(graph.getDirectDependents("A").sort()).toEqual(["B", "C"].sort());
    expect(graph.getDirectDependents("B")).toEqual(["D"]);
    expect(graph.getDirectDependents("D")).toEqual([]);
  });

  it("calculates transitive (downstream) dependents correctly", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    // Unlocking A enables B, C, and eventually D
    expect(graph.getAllDependents("A").sort()).toEqual(["B", "C", "D"].sort());
    expect(graph.getAllDependents("E")).toEqual([]);
  });

  it("detects clean DAG without cycles", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    const result = graph.detectCycle();
    expect(result.hasCycle).toBe(false);
    expect(result.cyclePath).toBeUndefined();
  });

  it("detects simple cycle (A -> B -> A) and returns cycle path", () => {
    const cyclicCompetencies: Competency[] = [
      {
        id: "X",
        domainId: "cyclic",
        title: "X",
        description: "X",
        category: "CONCEPTUAL",
        prerequisites: ["Y"],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "Y",
        domainId: "cyclic",
        title: "Y",
        description: "Y",
        category: "CONCEPTUAL",
        prerequisites: ["X"],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
    ];

    const graph = new PrerequisiteGraph(cyclicCompetencies);
    const result = graph.detectCycle();
    expect(result.hasCycle).toBe(true);
    expect(result.cyclePath).toBeDefined();
    expect(result.cyclePath!.length).toBeGreaterThanOrEqual(2);
  });

  it("detects complex multi-node cycle (A -> B -> C -> D -> B)", () => {
    const complexCycle: Competency[] = [
      {
        id: "1",
        domainId: "test",
        title: "1",
        description: "1",
        category: "CONCEPTUAL",
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "2",
        domainId: "test",
        title: "2",
        description: "2",
        category: "CONCEPTUAL",
        prerequisites: ["4"], // Cycle: 2 -> 4 -> 3 -> 2
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "3",
        domainId: "test",
        title: "3",
        description: "3",
        category: "CONCEPTUAL",
        prerequisites: ["2"],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
      {
        id: "4",
        domainId: "test",
        title: "4",
        description: "4",
        category: "CONCEPTUAL",
        prerequisites: ["3"],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
    ];

    const graph = new PrerequisiteGraph(complexCycle);
    const result = graph.detectCycle();
    expect(result.hasCycle).toBe(true);
  });

  it("detects dangling prerequisites", () => {
    const withDangling: Competency[] = [
      {
        id: "A",
        domainId: "test",
        title: "A",
        description: "A",
        category: "CONCEPTUAL",
        prerequisites: ["NON_EXISTENT_NODE"],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      },
    ];

    const graph = new PrerequisiteGraph(withDangling);
    const missing = graph.findDanglingPrerequisites();
    expect(missing).toEqual([
      { competencyId: "A", missingPrerequisiteId: "NON_EXISTENT_NODE" },
    ]);
  });

  it("produces deterministic valid topological order", () => {
    const graph = new PrerequisiteGraph(sampleCompetencies);
    const order = graph.getTopologicalOrder();

    // In sampleCompetencies:
    // A and E have 0 prerequisites -> must come before dependents
    // B and C depend on A -> must appear after A
    // D depends on B and C -> must appear after both B and C
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("B"));
    expect(order.indexOf("A")).toBeLessThan(order.indexOf("C"));
    expect(order.indexOf("B")).toBeLessThan(order.indexOf("D"));
    expect(order.indexOf("C")).toBeLessThan(order.indexOf("D"));
  });

  describe("Next Eligible Competency Discovery (§19, §20)", () => {
    it("returns root competencies when learner has 0 mastery", () => {
      const graph = new PrerequisiteGraph(sampleCompetencies);
      const eligible = graph.getNextEligibleCompetencies([]);
      const eligibleIds = eligible.map((c) => c.id);

      // Only A and E have no prerequisites
      expect(eligibleIds).toEqual(["A", "E"]);
    });

    it("unlocks dependent competencies when prerequisites are satisfied", () => {
      const graph = new PrerequisiteGraph(sampleCompetencies);
      // Learner masters A
      const eligible = graph.getNextEligibleCompetencies(["A"]);
      const eligibleIds = eligible.map((c) => c.id);

      // E is still available, B and C are now unlocked (prereq A met).
      // D is NOT unlocked yet because it requires both B and C.
      expect(eligibleIds.sort()).toEqual(["B", "C", "E"].sort());
      expect(eligibleIds).not.toContain("D");
    });

    it("unlocks join node (D) only when ALL prerequisites (B and C) are met", () => {
      const graph = new PrerequisiteGraph(sampleCompetencies);
      // Learner mastered A and B (but not C)
      let eligible = graph.getNextEligibleCompetencies(["A", "B"]);
      expect(eligible.map((c) => c.id)).toContain("C");
      expect(eligible.map((c) => c.id)).not.toContain("D");

      // Learner masters C as well
      eligible = graph.getNextEligibleCompetencies(["A", "B", "C"]);
      expect(eligible.map((c) => c.id)).toContain("D");
    });

    it("returns empty array when all competencies are mastered", () => {
      const graph = new PrerequisiteGraph(sampleCompetencies);
      const allIds = ["A", "B", "C", "D", "E"];
      const eligible = graph.getNextEligibleCompetencies(allIds);
      expect(eligible).toEqual([]);
    });
  });
});
