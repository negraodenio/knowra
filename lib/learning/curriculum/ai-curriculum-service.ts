import { aiGateway } from "@/lib/ai/gateway";
import { Competency } from "../types";
import { Domain } from "../domains";
import { DiagnosticItem } from "../diagnostic/types";
import { PracticeActivity } from "../activities/curriculum-activities";
import { PrerequisiteGraph } from "../prerequisite-graph";
import { dynamicCurriculumRegistry } from "./dynamic-registry";
import { createAdminClient } from "@/lib/db/supabase-admin";
import { isLiveDatabaseConfigured } from "@/lib/db/supabase-persistence";
import { logger } from "@/lib/observability/logger";

interface GeneratedCurriculumPayload {
  domain: {
    name: string;
    description: string;
    category: "CONCEPTUAL" | "PROCEDURAL" | "FACTUAL";
  };
  competencies: Array<{
    id: string;
    title: string;
    description: string;
    category: "CONCEPTUAL" | "PROCEDURAL" | "FACTUAL";
    difficulty: number;
    prerequisites: string[];
  }>;
  diagnosticItems: Array<{
    competencyId: string;
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    difficulty: number;
  }>;
  practiceActivities: Array<{
    competencyId: string;
    prompt: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    hints: string[];
  }>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export class AICurriculumService {
  /**
   * Generates a complete adaptive learning curriculum (Domain, Competency DAG,
   * Diagnostic items, and Practice activities) using the configured high-tier LLM.
   */
  async generateCurriculumForObjective(
    rawObjective: string,
    userId?: string
  ): Promise<{
    domain: Domain;
    competencies: Competency[];
    diagnosticItems: DiagnosticItem[];
  }> {
    const domainSlug = slugify(rawObjective) || `custom-${Date.now()}`;
    const domainId = `dyn-${domainSlug}`;

    logger.info("AICurriculumService: Generating curriculum for arbitrary objective", {
      rawObjective,
      domainId,
    });

    const systemPrompt = `You are an expert curriculum architect and cognitive scientist for Knowra, a universal adaptive learning platform.
Your task is to decompose any learning objective into a rigorous, prerequisite-driven Directed Acyclic Graph (DAG) of competencies, accompanied by diagnostic assessment items and practice exercises.

Return ONLY a valid JSON object with NO surrounding markdown or extra commentary. The JSON must follow this exact structure:
{
  "domain": {
    "name": "Concise, professional title of this study domain in Portuguese",
    "description": "Comprehensive explanation of what this learning path encompasses in Portuguese",
    "category": "CONCEPTUAL" or "PROCEDURAL" or "FACTUAL"
  },
  "competencies": [
    {
      "id": "short-slug-id-unique-within-domain",
      "title": "Title of competency in Portuguese",
      "description": "Clear conceptual or procedural summary in Portuguese",
      "category": "CONCEPTUAL" or "PROCEDURAL" or "FACTUAL",
      "difficulty": integer between 1 and 4,
      "prerequisites": ["array of competency ids that MUST be mastered before this one. Root competencies MUST have empty array []"]
    }
  ],
  "diagnosticItems": [
    {
      "competencyId": "matching-competency-id",
      "prompt": "Clear multiple-choice diagnostic question in Portuguese",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact string matching one of the options",
      "explanation": "Why this answer is correct in Portuguese",
      "difficulty": integer 1 to 4
    }
  ],
  "practiceActivities": [
    {
      "competencyId": "matching-competency-id",
      "prompt": "Interactive exercise or prompt in Portuguese",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Exact string matching one of the options",
      "explanation": "Detailed pedagogical explanation in Portuguese",
      "hints": ["Hint 1 in Portuguese", "Hint 2 in Portuguese"]
    }
  ]
}

CRITICAL PEDAGOGICAL CONSTRAINTS:
1. Provide between 5 and 7 essential competencies structured from foundational (difficulty 1) to advanced (difficulty 4). Keep descriptions and explanations concise and focused to ensure clean token generation.
2. The competency graph MUST be a valid DAG: NO circular dependencies, NO references to nonexistent IDs.
3. At least 1-2 foundational competencies MUST have empty prerequisites [] so the learner can start immediately.
4. For every competency, provide at least 1 diagnostic item and 1 practice activity.
5. All educational content must be written in Portuguese with high educational rigor and conceptual accuracy.`;

    const userPrompt = `Objective requested by learner: "${rawObjective}"
Design the complete adaptive curriculum, competency DAG, baseline diagnostics, and practice activities as a single JSON object.`;

    const response = await aiGateway.generateText({
      task: "COMPETENCY",
      systemPrompt,
      userPrompt,
      promptVersion: "ai_curriculum_v2",
      userId,
      temperature: 0.2,
      maxTokens: 8000,
    });

    const rawText = response.rawText.trim();
    let parsed: GeneratedCurriculumPayload;
    try {
      // 1. Try stripping markdown code fences
      let clean = rawText;
      if (clean.includes("```")) {
        const match = clean.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          clean = match[1].trim();
        }
      }
      parsed = JSON.parse(clean);
    } catch {
      // 2. Try substring from first { to last }
      try {
        const first = rawText.indexOf("{");
        const last = rawText.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          parsed = JSON.parse(rawText.slice(first, last + 1));
        } else {
          throw new Error("No JSON object found in response");
        }
      } catch (innerErr) {
        logger.error("AICurriculumService: Failed to parse JSON response from LLM", {
          preview: rawText.slice(0, 500),
          error: innerErr instanceof Error ? innerErr.message : String(innerErr),
        });
        throw new Error("Failed to parse AI-generated curriculum structure. Please try again.");
      }
    }

    // 1. Construct Domain
    const domain: Domain = {
      id: domainId,
      name: parsed.domain?.name || rawObjective,
      description: parsed.domain?.description || `Trilha de aprendizagem personalizada: ${rawObjective}`,
      primaryCategory: parsed.domain?.category || "CONCEPTUAL",
      isCurated: false,
      status: "ACTIVE",
      version: "1.0.0",
    };

    // 2. Normalize and Sanitize Competencies DAG
    const rawComps = parsed.competencies || [];
    const compIdSet = new Set<string>();

    // Prefix competency IDs to ensure uniqueness across domains
    const idPrefix = `${domainSlug.slice(0, 15)}-`;
    const normalizedComps: Competency[] = rawComps.map((c, idx) => {
      const cleanId = c.id?.startsWith(idPrefix) ? c.id : `${idPrefix}${slugify(c.id || `c${idx + 1}`)}`;
      compIdSet.add(cleanId);
      return {
        id: cleanId,
        domainId,
        title: c.title || `Competência ${idx + 1}`,
        description: c.description || "",
        category: (["CONCEPTUAL", "PROCEDURAL", "FACTUAL"].includes(c.category)
          ? c.category
          : "CONCEPTUAL") as "CONCEPTUAL" | "PROCEDURAL" | "FACTUAL",
        difficulty: Math.max(1, Math.min(5, Number(c.difficulty) || 1)),
        prerequisites: [], // resolved below
        version: 1,
        status: "ACTIVE",
        provenance: "AI_GENERATED",
      };
    });

    // Remap prerequisites
    const idMapping = new Map<string, string>();
    rawComps.forEach((c, idx) => {
      idMapping.set(c.id, normalizedComps[idx].id);
      idMapping.set(normalizedComps[idx].id, normalizedComps[idx].id);
    });

    rawComps.forEach((raw, idx) => {
      const remappedPrereqs = (raw.prerequisites || [])
        .map((pId) => idMapping.get(pId))
        .filter((mappedId): mappedId is string => Boolean(mappedId && mappedId !== normalizedComps[idx].id));
      normalizedComps[idx].prerequisites = Array.from(new Set(remappedPrereqs));
    });

    // 3. Guarantee Valid DAG (No cycles, no dangling prerequisites)
    const validCompetencies = this.sanitizeDAG(normalizedComps);

    // 4. Normalize Diagnostic Items
    const diagnosticItems: DiagnosticItem[] = (parsed.diagnosticItems || []).map((item, idx) => {
      const targetCompId = idMapping.get(item.competencyId) || validCompetencies[0]?.id;
      const opts = Array.isArray(item.options) && item.options.length >= 2 ? item.options : ["Verdadeiro", "Falso"];
      const correctAns = opts.includes(item.correctAnswer) ? item.correctAnswer : opts[0];

      return {
        id: `diag-${domainSlug.slice(0, 12)}-${idx + 1}`,
        domainId,
        competencyId: targetCompId,
        prompt: item.prompt,
        itemType: "MULTIPLE_CHOICE",
        difficulty: Math.max(1, Math.min(5, Number(item.difficulty) || 1)),
        options: opts,
        correctAnswer: correctAns,
        explanation: item.explanation || "",
        version: 1,
        provenance: "AI_GENERATED",
        status: "ACTIVE",
      };
    });

    // Ensure every competency has at least one diagnostic question
    for (const comp of validCompetencies) {
      const hasItem = diagnosticItems.some((di) => di.competencyId === comp.id);
      if (!hasItem) {
        diagnosticItems.push({
          id: `diag-${comp.id}-fallback`,
          domainId,
          competencyId: comp.id,
          prompt: `Em relação ao tópico "${comp.title}", qual das opções melhor descreve seus fundamentos?`,
          itemType: "MULTIPLE_CHOICE",
          difficulty: comp.difficulty,
          options: [
            comp.description,
            "Não possui relação com o tema.",
            "Aplica-se apenas em casos excepcionais.",
            "É um conceito descontinuado.",
          ],
          correctAnswer: comp.description,
          explanation: `O conceito correto para ${comp.title} é: ${comp.description}`,
          version: 1,
          provenance: "AI_GENERATED",
          status: "ACTIVE",
        });
      }
    }

    // 5. Normalize Practice Activities
    const practiceActivities: PracticeActivity[] = (parsed.practiceActivities || []).map((act, idx) => {
      const targetCompId = idMapping.get(act.competencyId) || validCompetencies[0]?.id;
      const comp = validCompetencies.find((c) => c.id === targetCompId) || validCompetencies[0];
      const opts = Array.isArray(act.options) && act.options.length >= 2 ? act.options : ["Correto", "Incorreto"];
      const correctAns = opts.includes(act.correctAnswer) ? act.correctAnswer : opts[0];

      return {
        competencyId: targetCompId,
        domainId,
        title: comp?.title || "Prática",
        category: comp?.category === "PROCEDURAL" ? "PROCEDURAL" : "CONCEPTUAL",
        objective: `Demonstrar domínio em ${comp?.title}`,
        instruction: comp?.description || "",
        keyConcepts: [
          `Fundamentos de ${comp?.title}`,
          "Aplicação prática e contextualização",
          "Análise crítica de evidências",
        ],
        practice: {
          id: `prac-${domainSlug.slice(0, 12)}-${idx + 1}`,
          prompt: act.prompt,
          itemType: "MULTIPLE_CHOICE",
          options: opts,
          correctAnswer: correctAns,
          explanation: act.explanation || "",
          hints: Array.isArray(act.hints) ? act.hints : ["Revise a definição conceitual."],
        },
      };
    });

    // 6. Register in memory
    dynamicCurriculumRegistry.registerDomain(domain);
    dynamicCurriculumRegistry.registerCompetencies(domainId, validCompetencies);
    dynamicCurriculumRegistry.registerDiagnosticItems(domainId, diagnosticItems);
    practiceActivities.forEach((act) => dynamicCurriculumRegistry.registerPracticeActivity(act));

    // 7. Persist to Supabase if live DB configured
    await this.persistToSupabase(domain, validCompetencies, diagnosticItems);

    logger.info("AICurriculumService: Successfully registered curriculum", {
      domainId,
      competenciesCount: validCompetencies.length,
      diagnosticItemsCount: diagnosticItems.length,
    });

    return { domain, competencies: validCompetencies, diagnosticItems };
  }

  /**
   * Sanitizes competencies to guarantee a valid DAG.
   * Eliminates dangling prerequisites and resolves any circular dependencies.
   */
  private sanitizeDAG(comps: Competency[]): Competency[] {
    const compMap = new Map<string, Competency>();
    comps.forEach((c) => compMap.set(c.id, { ...c, prerequisites: [...c.prerequisites] }));

    // 1. Remove dangling prerequisites
    comps.forEach((c) => {
      c.prerequisites = c.prerequisites.filter((pId) => compMap.has(pId));
    });

    // 2. Break cycles if any
    let graph = new PrerequisiteGraph(comps);
    let cycle = graph.detectCycle();
    let maxResolutions = 10;

    while (cycle.hasCycle && cycle.cyclePath && maxResolutions > 0) {
      maxResolutions--;
      const from = cycle.cyclePath[cycle.cyclePath.length - 2];
      const to = cycle.cyclePath[cycle.cyclePath.length - 1];
      const target = comps.find((c) => c.id === to);
      if (target) {
        target.prerequisites = target.prerequisites.filter((p) => p !== from);
      }
      graph = new PrerequisiteGraph(comps);
      cycle = graph.detectCycle();
    }

    // Ensure at least one competency has 0 prerequisites
    const roots = comps.filter((c) => c.prerequisites.length === 0);
    if (roots.length === 0 && comps.length > 0) {
      comps[0].prerequisites = [];
    }

    return comps;
  }

  /**
   * Persists domain, competencies, prerequisites, and diagnostic items to Supabase.
   */
  private async persistToSupabase(
    domain: Domain,
    competencies: Competency[],
    diagnosticItems: DiagnosticItem[]
  ): Promise<void> {
    if (!isLiveDatabaseConfigured()) return;

    try {
      const supabase = createAdminClient();

      // Upsert Domain
      await supabase.from("domains").upsert({
        id: domain.id,
        name: domain.name,
        description: domain.description,
        category: domain.primaryCategory,
        is_curated: false,
        status: "ACTIVE",
      });

      // Upsert Competencies
      for (const comp of competencies) {
        await supabase.from("competencies").upsert({
          id: comp.id,
          domain_id: domain.id,
          title: comp.title,
          description: comp.description,
          category: comp.category,
          difficulty: comp.difficulty,
          version: 1,
          status: "ACTIVE",
          provenance: "AI_GENERATED",
        });
      }

      // Upsert Prerequisites
      for (const comp of competencies) {
        for (const prereqId of comp.prerequisites) {
          await supabase.from("competency_prerequisites").upsert({
            competency_id: comp.id,
            prerequisite_id: prereqId,
          });
        }
      }

      // Upsert Diagnostic Items
      for (const item of diagnosticItems) {
        await supabase.from("diagnostic_items").upsert({
          id: item.id,
          domain_id: domain.id,
          competency_id: item.competencyId,
          prompt: item.prompt,
          item_type: item.itemType,
          difficulty: item.difficulty,
          options: item.options ? JSON.stringify(item.options) : null,
          correct_answer: item.correctAnswer,
          explanation: item.explanation || "",
          version: item.version || 1,
          provenance: "AI_GENERATED",
          status: "ACTIVE",
        });
      }
    } catch (err) {
      logger.warn("AICurriculumService: Failed to persist curriculum to Supabase", {
        error: String(err),
      });
    }
  }
}

export const aiCurriculumService = new AICurriculumService();
