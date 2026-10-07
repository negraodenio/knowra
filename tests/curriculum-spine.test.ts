import { describe, it, expect } from "vitest";
import { competencyMapService } from "@/lib/learning/competency-map";
import { getAllCuratedDomains } from "@/lib/learning/domains";
import {
  PYTHON_COMPETENCIES,
  MATHEMATICS_COMPETENCIES,
  EXCEL_COMPETENCIES,
} from "@/lib/learning/curriculum";

describe("Curated MVP Curriculum Spine Validation (§5, §6, §8)", () => {
  const domains = getAllCuratedDomains();

  it("registers exactly the 3 approved MVP domains (§5)", () => {
    const domainIds = domains.map((d) => d.id);
    expect(domainIds).toEqual(["python-junior", "math-exams", "excel-pro"]);
  });

  describe.each([
    ["python-junior", PYTHON_COMPETENCIES],
    ["math-exams", MATHEMATICS_COMPETENCIES],
    ["excel-pro", EXCEL_COMPETENCIES],
  ])("Domain Spine: %s", (domainId, competencies) => {
    it("contains a substantive curated competency set", () => {
      expect(competencies.length).toBeGreaterThanOrEqual(8);
    });

    it("has 0 dangling prerequisites", () => {
      const graph = competencyMapService.getGraph(domainId);
      expect(graph).toBeDefined();
      expect(graph!.findDanglingPrerequisites()).toEqual([]);
    });

    it("is a strict DAG with 0 circular dependency cycles", () => {
      const graph = competencyMapService.getGraph(domainId);
      const cycleResult = graph!.detectCycle();
      expect(cycleResult.hasCycle).toBe(false);
    });

    it("generates a complete deterministic topological order covering all nodes", () => {
      const order = competencyMapService.getTopologicalOrder(domainId);
      expect(order.length).toBe(competencies.length);

      // Verify prerequisite ordering invariant for all nodes in topological order
      const graph = competencyMapService.getGraph(domainId)!;
      for (const compId of order) {
        const prereqs = graph.getDirectPrerequisites(compId);
        for (const p of prereqs) {
          expect(order.indexOf(p)).toBeLessThan(order.indexOf(compId));
        }
      }
    });

    it("verifies all competencies have valid status, provenance and taxonomies", () => {
      for (const comp of competencies) {
        expect(comp.domainId).toBe(domainId);
        expect(comp.provenance).toBe("CURATED");
        expect(comp.status).toBe("ACTIVE");
        expect(["CONCEPTUAL", "PROCEDURAL", "FACTUAL"]).toContain(comp.category);
        expect(comp.difficulty).toBeGreaterThanOrEqual(1);
        expect(comp.difficulty).toBeLessThanOrEqual(5);
      }
    });

    it("resolves next eligible competencies starting from zero mastery", () => {
      const eligible = competencyMapService.getNextEligibleCompetencies(domainId, []);
      expect(eligible.length).toBeGreaterThan(0);
      // All initial eligible competencies must have 0 prerequisites
      for (const comp of eligible) {
        expect(comp.prerequisites.length).toBe(0);
      }
    });
  });
});
