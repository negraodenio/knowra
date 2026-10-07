import { Competency } from "./types";
import { PrerequisiteGraph } from "./prerequisite-graph";
import { getCuratedCompetenciesByDomain } from "./curriculum";
import { getDomain } from "./domains";

export interface CompetencyMapVersion {
  domainId: string;
  version: string;
  competencies: Competency[];
  graph: PrerequisiteGraph;
  topologicalOrder: string[];
}

export class CompetencyMapService {
  private mapRegistry: Map<string, CompetencyMapVersion> = new Map();

  constructor() {
    this.initializeCuratedMaps();
  }

  private initializeCuratedMaps(): void {
    const domainIds = ["python-junior", "math-exams", "excel-pro"];

    for (const domainId of domainIds) {
      const domain = getDomain(domainId);
      if (!domain) continue;

      const competencies = getCuratedCompetenciesByDomain(domainId);
      const graph = new PrerequisiteGraph(competencies);

      // Verify DAG integrity (§6, §8)
      const dangling = graph.findDanglingPrerequisites();
      if (dangling.length > 0) {
        throw new Error(
          `Domain ${domainId} has dangling prerequisites: ${JSON.stringify(dangling)}`
        );
      }

      const cycleResult = graph.detectCycle();
      if (cycleResult.hasCycle) {
        throw new Error(
          `Domain ${domainId} has circular dependency cycle: ${cycleResult.cyclePath?.join(" -> ")}`
        );
      }

      const topologicalOrder = graph.getTopologicalOrder();

      const versionKey = `${domainId}@${domain.version}`;
      this.mapRegistry.set(versionKey, {
        domainId,
        version: domain.version,
        competencies,
        graph,
        topologicalOrder,
      });
    }
  }

  getMap(domainId: string, version: string = "1.0.0"): CompetencyMapVersion | undefined {
    return this.mapRegistry.get(`${domainId}@${version}`);
  }

  getGraph(domainId: string, version: string = "1.0.0"): PrerequisiteGraph | undefined {
    return this.getMap(domainId, version)?.graph;
  }

  getTopologicalOrder(domainId: string, version: string = "1.0.0"): string[] {
    const map = this.getMap(domainId, version);
    if (!map) {
      throw new Error(`Competency map not found for domain ${domainId} version ${version}`);
    }
    return map.topologicalOrder;
  }

  getNextEligibleCompetencies(
    domainId: string,
    masteredIds: string[] | Set<string>,
    version: string = "1.0.0"
  ): Competency[] {
    const graph = this.getGraph(domainId, version);
    if (!graph) {
      throw new Error(`Graph not found for domain ${domainId} version ${version}`);
    }
    return graph.getNextEligibleCompetencies(masteredIds);
  }
}

export const competencyMapService = new CompetencyMapService();
