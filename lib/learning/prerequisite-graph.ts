import { Competency } from "./types";

export interface CycleDetectionResult {
  hasCycle: boolean;
  cyclePath?: string[];
}

/**
 * PrerequisiteGraph Engine (§8, §50)
 * Deterministic, pure Directed Acyclic Graph (DAG) analysis:
 * - Direct & transitive prerequisites
 * - Direct & transitive dependents
 * - Cycle detection with cycle path reporting
 * - Deterministic topological sorting
 * - Next eligible competency discovery based on learner mastery
 */
export class PrerequisiteGraph {
  private competencies: Map<string, Competency> = new Map();
  // adjacency: competency -> set of direct prerequisites
  private prereqMap: Map<string, Set<string>> = new Map();
  // reverse adjacency: competency -> set of competencies that depend on it
  private dependentMap: Map<string, Set<string>> = new Map();

  constructor(competencies: Competency[]) {
    for (const comp of competencies) {
      this.competencies.set(comp.id, comp);
      this.prereqMap.set(comp.id, new Set(comp.prerequisites));
      if (!this.dependentMap.has(comp.id)) {
        this.dependentMap.set(comp.id, new Set());
      }
    }

    // Populate dependent map (reverse edges)
    for (const comp of competencies) {
      for (const prereqId of comp.prerequisites) {
        if (!this.dependentMap.has(prereqId)) {
          this.dependentMap.set(prereqId, new Set());
        }
        this.dependentMap.get(prereqId)!.add(comp.id);
      }
    }
  }

  getCompetency(id: string): Competency | undefined {
    return this.competencies.get(id);
  }

  getAllCompetencyIds(): string[] {
    return Array.from(this.competencies.keys());
  }

  /**
   * Direct prerequisites: immediate dependencies required for this competency.
   */
  getDirectPrerequisites(id: string): string[] {
    const prereqs = this.prereqMap.get(id);
    return prereqs ? Array.from(prereqs) : [];
  }

  /**
   * Transitive prerequisites: all ancestors required upstream to master this competency.
   */
  getAllPrerequisites(id: string): string[] {
    const visited = new Set<string>();

    const dfs = (currentId: string) => {
      const direct = this.prereqMap.get(currentId);
      if (!direct) return;

      for (const p of direct) {
        if (!visited.has(p)) {
          visited.add(p);
          dfs(p);
        }
      }
    };

    dfs(id);
    return Array.from(visited);
  }

  /**
   * Direct dependents: competencies that directly require this competency.
   */
  getDirectDependents(id: string): string[] {
    const deps = this.dependentMap.get(id);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Transitive dependents: all downstream competencies unlocked or affected by this competency.
   */
  getAllDependents(id: string): string[] {
    const visited = new Set<string>();

    const dfs = (currentId: string) => {
      const direct = this.dependentMap.get(currentId);
      if (!direct) return;

      for (const d of direct) {
        if (!visited.has(d)) {
          visited.add(d);
          dfs(d);
        }
      }
    };

    dfs(id);
    return Array.from(visited);
  }

  /**
   * Cycle Detection using 3-color DFS (WHITE=0, GREY=1, BLACK=2).
   * Returns whether a cycle exists and the path of the cycle if present.
   */
  detectCycle(): CycleDetectionResult {
    enum State {
      UNVISITED = 0,
      VISITING = 1,
      VISITED = 2,
    }

    const stateMap = new Map<string, State>();
    for (const id of this.competencies.keys()) {
      stateMap.set(id, State.UNVISITED);
    }

    const currentPath: string[] = [];

    for (const startNode of this.competencies.keys()) {
      if (stateMap.get(startNode) === State.UNVISITED) {
        const cycleFound = this.dfsCycle(startNode, stateMap, currentPath);
        if (cycleFound) {
          return {
            hasCycle: true,
            cyclePath: cycleFound,
          };
        }
      }
    }

    return { hasCycle: false };
  }

  private dfsCycle(
    node: string,
    stateMap: Map<string, number>,
    currentPath: string[]
  ): string[] | null {
    stateMap.set(node, 1); // VISITING
    currentPath.push(node);

    const prerequisites = this.prereqMap.get(node) || new Set();
    for (const prereq of prerequisites) {
      // Only traverse known nodes in the competency graph
      if (!this.competencies.has(prereq)) continue;

      const prereqState = stateMap.get(prereq);
      if (prereqState === 1) { // Cycle detected!
        const cycleStartIndex = currentPath.indexOf(prereq);
        return [...currentPath.slice(cycleStartIndex), prereq];
      }

      if (prereqState === 0) {
        const cycle = this.dfsCycle(prereq, stateMap, currentPath);
        if (cycle) return cycle;
      }
    }

    currentPath.pop();
    stateMap.set(node, 2); // VISITED
    return null;
  }

  /**
   * Validates if any competency references a prerequisite that does not exist.
   */
  findDanglingPrerequisites(): Array<{ competencyId: string; missingPrerequisiteId: string }> {
    const missing: Array<{ competencyId: string; missingPrerequisiteId: string }> = [];

    for (const [compId, prereqs] of this.prereqMap.entries()) {
      for (const pId of prereqs) {
        if (!this.competencies.has(pId)) {
          missing.push({ competencyId: compId, missingPrerequisiteId: pId });
        }
      }
    }

    return missing;
  }

  /**
   * Deterministic Topological Order.
   * Uses Kahn's algorithm with priority ordering by difficulty and ID for reproducibility.
   * Throws an Error if a cycle is detected.
   */
  getTopologicalOrder(): string[] {
    const cycleCheck = this.detectCycle();
    if (cycleCheck.hasCycle) {
      throw new Error(`Cannot compute topological order: Cycle detected [${cycleCheck.cyclePath?.join(" -> ")}]`);
    }

    // In-degree for Kahn's algorithm: number of unresolved prerequisites
    const inDegree = new Map<string, number>();
    for (const id of this.competencies.keys()) {
      // in-degree = count of prerequisites belonging to this graph
      const validPrereqs = Array.from(this.prereqMap.get(id) || []).filter((p) => this.competencies.has(p));
      inDegree.set(id, validPrereqs.length);
    }

    // Queue of nodes with in-degree 0 (ready to learn)
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    // Sort initial queue for deterministic order (difficulty asc, id asc)
    this.sortNodes(queue);

    const ordered: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      ordered.push(current);

      const dependents = this.dependentMap.get(current) || new Set();
      for (const dep of dependents) {
        if (!this.competencies.has(dep)) continue;

        const currentDeg = inDegree.get(dep)! - 1;
        inDegree.set(dep, currentDeg);

        if (currentDeg === 0) {
          queue.push(dep);
          this.sortNodes(queue);
        }
      }
    }

    if (ordered.length !== this.competencies.size) {
      throw new Error("Topological sort failed to order all competencies.");
    }

    return ordered;
  }

  /**
   * Next Eligible Competency Discovery (§19, §20)
   * Given a set of competencies already mastered by the learner:
   * Returns all competencies whose prerequisites are 100% satisfied,
   * but which have NOT yet been mastered by the learner.
   */
  getNextEligibleCompetencies(masteredIds: Set<string> | string[]): Competency[] {
    const mastered = masteredIds instanceof Set ? masteredIds : new Set(masteredIds);
    const eligible: Competency[] = [];

    for (const [id, comp] of this.competencies.entries()) {
      // If already mastered, not eligible for initial learning
      if (mastered.has(id)) continue;

      const prereqs = this.prereqMap.get(id) || new Set();
      let allPrereqsMet = true;

      for (const p of prereqs) {
        if (!mastered.has(p)) {
          allPrereqsMet = false;
          break;
        }
      }

      if (allPrereqsMet) {
        eligible.push(comp);
      }
    }

    // Sort eligible competencies deterministically: difficulty asc, then id asc
    eligible.sort((a, b) => {
      if (a.difficulty !== b.difficulty) {
        return a.difficulty - b.difficulty;
      }
      return a.id.localeCompare(b.id);
    });

    return eligible;
  }

  private sortNodes(nodeIds: string[]): void {
    nodeIds.sort((a, b) => {
      const compA = this.competencies.get(a);
      const compB = this.competencies.get(b);
      const diffA = compA?.difficulty ?? 1;
      const diffB = compB?.difficulty ?? 1;
      if (diffA !== diffB) return diffA - diffB;
      return a.localeCompare(b);
    });
  }
}
