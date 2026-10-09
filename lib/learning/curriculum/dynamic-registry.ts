import { Competency } from "../types";
import { Domain } from "../domains";
import { DiagnosticItem } from "../diagnostic/types";
import { PracticeActivity } from "../activities/curriculum-activities";
import { CompetencyMapVersion } from "../competency-map";
import { PrerequisiteGraph } from "../prerequisite-graph";
import { logger } from "@/lib/observability/logger";

class DynamicCurriculumRegistry {
  private domains = new Map<string, Domain>();
  private competenciesByDomain = new Map<string, Competency[]>();
  private competenciesById = new Map<string, Competency>();
  private diagnosticItemsByDomain = new Map<string, DiagnosticItem[]>();
  private diagnosticItemsById = new Map<string, DiagnosticItem>();
  private activitiesByCompId = new Map<string, PracticeActivity>();
  private mapVersions = new Map<string, CompetencyMapVersion>();

  registerDomain(domain: Domain): void {
    this.domains.set(domain.id, domain);
  }

  getDomain(domainId: string): Domain | undefined {
    return this.domains.get(domainId);
  }

  getAllDomains(): Domain[] {
    return Array.from(this.domains.values());
  }

  registerCompetencies(domainId: string, competencies: Competency[]): void {
    this.competenciesByDomain.set(domainId, competencies);
    for (const comp of competencies) {
      this.competenciesById.set(comp.id, comp);
    }

    // Build & register prerequisite DAG
    try {
      const graph = new PrerequisiteGraph(competencies);
      const topologicalOrder = graph.getTopologicalOrder();
      const domain = this.domains.get(domainId);
      const version = domain?.version || "1.0.0";
      const versionKey = `${domainId}@${version}`;

      this.mapVersions.set(versionKey, {
        domainId,
        version,
        competencies,
        graph,
        topologicalOrder,
      });
    } catch (err) {
      logger.error("Failed to build DAG for dynamic domain", { domainId, error: String(err) });
    }
  }

  getCompetenciesByDomain(domainId: string): Competency[] {
    return this.competenciesByDomain.get(domainId) || [];
  }

  getCompetencyById(competencyId: string): Competency | undefined {
    return this.competenciesById.get(competencyId);
  }

  registerDiagnosticItems(domainId: string, items: DiagnosticItem[]): void {
    this.diagnosticItemsByDomain.set(domainId, items);
    for (const item of items) {
      this.diagnosticItemsById.set(item.id, item);
    }
  }

  getDiagnosticItemsByDomain(domainId: string): DiagnosticItem[] {
    return this.diagnosticItemsByDomain.get(domainId) || [];
  }

  getDiagnosticItemById(itemId: string): DiagnosticItem | undefined {
    return this.diagnosticItemsById.get(itemId);
  }

  registerPracticeActivity(activity: PracticeActivity): void {
    this.activitiesByCompId.set(activity.competencyId, activity);
  }

  getPracticeActivity(competencyId: string): PracticeActivity | undefined {
    return this.activitiesByCompId.get(competencyId);
  }

  getMapVersion(domainId: string, version: string = "1.0.0"): CompetencyMapVersion | undefined {
    let mv = this.mapVersions.get(`${domainId}@${version}`);
    if (!mv) {
      const comps = this.competenciesByDomain.get(domainId);
      if (comps && comps.length > 0) {
        try {
          const graph = new PrerequisiteGraph(comps);
          let topologicalOrder: string[] = [];
          try {
            topologicalOrder = graph.getTopologicalOrder();
          } catch {
            topologicalOrder = comps.map((c) => c.id);
          }
          mv = {
            domainId,
            version,
            competencies: comps,
            graph,
            topologicalOrder,
          };
          this.mapVersions.set(`${domainId}@${version}`, mv);
        } catch (err) {
          logger.error("getMapVersion dynamic assembly failed", { domainId, error: String(err) });
        }
      }
    }
    return mv;
  }

  getGraph(domainId: string, version: string = "1.0.0"): PrerequisiteGraph | undefined {
    return this.getMapVersion(domainId, version)?.graph;
  }

  async loadDomainFromDatabase(domainId: string): Promise<boolean> {
    if (
      this.domains.has(domainId) &&
      this.competenciesByDomain.has(domainId) &&
      this.diagnosticItemsByDomain.has(domainId) &&
      this.mapVersions.has(`${domainId}@1.0.0`)
    ) {
      return true;
    }

    try {
      const { createAdminClient } = await import("@/lib/db/supabase-admin");
      const { isLiveDatabaseConfigured } = await import("@/lib/db/supabase-persistence");
      if (!isLiveDatabaseConfigured()) return false;

      const supabase = createAdminClient();
      const { data: domainData } = await supabase
        .from("domains")
        .select("*")
        .eq("id", domainId)
        .maybeSingle();

      if (!domainData) return false;

      const domain: Domain = {
        id: domainData.id,
        name: domainData.name,
        description: domainData.description || "",
        primaryCategory: domainData.category,
        isCurated: domainData.is_curated,
        status: domainData.status,
        version: "1.0.0",
      };
      this.registerDomain(domain);

      const { data: compsData } = await supabase
        .from("competencies")
        .select("*")
        .eq("domain_id", domainId);

      const comps: Competency[] = [];
      if (compsData && compsData.length > 0) {
        const compIds = compsData.map((c) => c.id);
        const { data: prereqsData } = await supabase
          .from("competency_prerequisites")
          .select("*")
          .in("competency_id", compIds);

        const prereqMap = new Map<string, string[]>();
        for (const p of prereqsData || []) {
          const list = prereqMap.get(p.competency_id) || [];
          list.push(p.prerequisite_id);
          prereqMap.set(p.competency_id, list);
        }

        for (const c of compsData) {
          comps.push({
            id: c.id,
            domainId: c.domain_id,
            title: c.title,
            description: c.description,
            category: c.category,
            difficulty: c.difficulty,
            prerequisites: prereqMap.get(c.id) || [],
            version: c.version || 1,
            status: c.status || "ACTIVE",
            provenance: c.provenance || "AI_GENERATED",
          });
        }
        this.registerCompetencies(domainId, comps);
      }

      const { data: diagData } = await supabase
        .from("diagnostic_items")
        .select("*")
        .eq("domain_id", domainId);

      if (diagData && diagData.length > 0) {
        const diagItems: DiagnosticItem[] = diagData.map((d) => ({
          id: d.id,
          domainId: d.domain_id,
          competencyId: d.competency_id,
          prompt: d.prompt,
          itemType: d.item_type,
          difficulty: d.difficulty,
          options: typeof d.options === "string" ? JSON.parse(d.options) : d.options || [],
          correctAnswer: d.correct_answer,
          explanation: d.explanation || "",
          version: d.version || 1,
          provenance: d.provenance || "AI_GENERATED",
          status: d.status || "ACTIVE",
        }));
        this.registerDiagnosticItems(domainId, diagItems);
      }

      return true;
    } catch (err) {
      logger.warn("DynamicCurriculumRegistry: Error loading domain from database", { domainId, error: String(err) });
      return false;
    }
  }

  async ensureCompetencyLoaded(competencyId: string): Promise<Competency | undefined> {
    const existing = this.getCompetencyById(competencyId);
    if (existing) return existing;

    try {
      const { createAdminClient } = await import("@/lib/db/supabase-admin");
      const { isLiveDatabaseConfigured } = await import("@/lib/db/supabase-persistence");
      if (!isLiveDatabaseConfigured()) return undefined;

      const supabase = createAdminClient();
      const { data: c } = await supabase
        .from("competencies")
        .select("domain_id")
        .eq("id", competencyId)
        .maybeSingle();

      if (!c) return undefined;
      await this.loadDomainFromDatabase(c.domain_id);
      return this.getCompetencyById(competencyId);
    } catch {
      return undefined;
    }
  }
}

const globalRegistryKey = Symbol.for("knowra.dynamicCurriculumRegistry");
const globalObj = globalThis as unknown as { [key: symbol]: DynamicCurriculumRegistry };

export const dynamicCurriculumRegistry: DynamicCurriculumRegistry =
  globalObj[globalRegistryKey] || (globalObj[globalRegistryKey] = new DynamicCurriculumRegistry());
