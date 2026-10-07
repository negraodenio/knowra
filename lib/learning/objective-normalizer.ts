import { z } from "zod";
import { aiGateway } from "@/lib/ai/gateway";
import { getDomain } from "./domains";
import { logger } from "@/lib/observability/logger";

export const NormalizedObjectiveSchema = z.object({
  domainId: z.string(),
  targetOutcome: z.string(),
  scope: z.enum(["FOUNDATIONAL", "INTERMEDIATE", "COMPREHENSIVE", "EXAM_PREP"]),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  deadline: z.string().optional(),
  clarificationNeeded: z.boolean().default(false),
  clarificationQuestion: z.string().optional(),
});

export type NormalizedObjective = z.infer<typeof NormalizedObjectiveSchema>;

export interface NormalizeObjectiveInput {
  rawObjective: string;
  selectedDomainId: string;
  targetOutcome?: string;
  selfReportedLevel?: string;
  deadline?: string;
  userId?: string;
}

export interface NormalizationResult {
  normalized: NormalizedObjective;
  source: "AI_NORMALIZED" | "DETERMINISTIC_FALLBACK";
  modelUsed?: string;
  promptVersion?: string;
  timestamp: string;
}

const PROMPT_VERSION = "OBJECTIVE_NORMALIZER_V1";

export async function normalizeObjective(
  input: NormalizeObjectiveInput
): Promise<NormalizationResult> {
  const { rawObjective, selectedDomainId, targetOutcome, selfReportedLevel, deadline, userId } = input;

  const domain = getDomain(selectedDomainId);
  if (!domain) {
    throw new Error(`Invalid domain ID '${selectedDomainId}'. Domain must exist in approved curriculum.`);
  }

  // If raw input is too short or completely ambiguous, return clarification state (§5)
  if (!rawObjective || rawObjective.trim().length < 3) {
    return {
      normalized: {
        domainId: selectedDomainId,
        targetOutcome: targetOutcome || `Learn ${domain.name}`,
        scope: "FOUNDATIONAL",
        level: "BEGINNER",
        clarificationNeeded: true,
        clarificationQuestion: "Please describe what specific goal or outcome you would like to achieve.",
      },
      source: "DETERMINISTIC_FALLBACK",
      timestamp: new Date().toISOString(),
    };
  }

  // Attempt AI normalization if OPENROUTER_API_KEY is available
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const systemPrompt = `You are a learning objective normalization assistant for the domain: "${domain.name}".
Your task is to convert the user's natural language goal into a structured, normalized objective.
Domain ID MUST strictly be: "${selectedDomainId}". Do NOT invent other domains.
If the goal is too ambiguous or irrelevant to ${domain.name}, set clarificationNeeded: true and provide clarificationQuestion.`;

      const userPrompt = `User goal: "${rawObjective}"
Target outcome provided: "${targetOutcome || "None"}"
Self-reported level: "${selfReportedLevel || "Not provided"}"
Deadline: "${deadline || "None"}"`;

      const aiResult = await aiGateway.generateStructured({
        task: "PLAN",
        systemPrompt,
        userPrompt,
        promptVersion: PROMPT_VERSION,
        schema: NormalizedObjectiveSchema,
        userId,
        temperature: 0.1,
      });

      return {
        normalized: {
          ...aiResult.data,
          domainId: selectedDomainId, // enforce domain constraint (§5)
        },
        source: "AI_NORMALIZED",
        modelUsed: aiResult.model,
        promptVersion: aiResult.promptVersion,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn("AI objective normalization failed, falling back to deterministic normalizer", {
        error: String(err),
      });
    }
  }

  // Deterministic fallback normalizer
  const lower = rawObjective.toLowerCase();
  let scope: "FOUNDATIONAL" | "INTERMEDIATE" | "COMPREHENSIVE" | "EXAM_PREP" = "FOUNDATIONAL";
  if (lower.includes("exam") || lower.includes("test") || lower.includes("prova")) {
    scope = "EXAM_PREP";
  } else if (lower.includes("junior") || lower.includes("job") || lower.includes("trabalho") || lower.includes("work")) {
    scope = "COMPREHENSIVE";
  } else if (lower.includes("intermediate") || lower.includes("avancado") || lower.includes("advanced")) {
    scope = "INTERMEDIATE";
  }

  let level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" = "BEGINNER";
  if (selfReportedLevel) {
    const sLevel = selfReportedLevel.toUpperCase();
    if (sLevel.includes("ADVANCED")) level = "ADVANCED";
    else if (sLevel.includes("INTERMEDIATE")) level = "INTERMEDIATE";
  }

  return {
    normalized: {
      domainId: selectedDomainId,
      targetOutcome: targetOutcome || rawObjective.trim(),
      scope,
      level,
      deadline,
      clarificationNeeded: false,
    },
    source: "DETERMINISTIC_FALLBACK",
    timestamp: new Date().toISOString(),
  };
}
