import { z } from "zod";
import { aiGateway } from "./gateway";
import { Competency } from "../learning/types";
import { AssessmentItem, AssessmentType } from "../learning/assessment/types";

export const GeneratedAssessmentItemSchema = z.object({
  prompt: z.string().min(10),
  itemType: z.enum(["MULTIPLE_CHOICE", "SHORT_ANSWER", "NUMERIC", "TRUE_FALSE"]),
  difficulty: z.number().int().min(1).max(5),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string(),
});
export type GeneratedAssessmentItem = z.infer<typeof GeneratedAssessmentItemSchema>;

export interface GenerateAssessmentItemInput {
  competency: Competency;
  domainId: string;
  formType: AssessmentType;
  baselinePromptsToAvoid?: string[];
  userId?: string;
}

export interface GenerateAssessmentItemOutput {
  success: boolean;
  item?: AssessmentItem;
  error?: string;
  modelUsed?: string;
}

const ASSESSMENT_PROMPT_VERSION = "ASSESSMENT_GEN_V1";

/**
 * AI-Assisted Assessment Item Generator (§11, §12)
 * Generates an independent, non-leaking assessment item via AI Gateway.
 * Output is strictly validated using Zod against GeneratedAssessmentItemSchema.
 */
export async function generateIndependentAssessmentItemWithAI(
  input: GenerateAssessmentItemInput
): Promise<GenerateAssessmentItemOutput> {
  const { competency, domainId, formType, baselinePromptsToAvoid = [], userId } = input;

  const systemPrompt = `You are an expert psychometrician and assessment designer for the Universal Adaptive Learning Platform.
Your goal is to generate an INDEPENDENT evaluation question for the specified competency.
CRITICAL INDEPENDENCE RULE:
The question MUST NOT repeat, duplicate, or trivial-variant any baseline prompts provided.
It must measure the deep conceptual or procedural understanding of the competency using a fresh, realistic context.
You MUST output valid JSON matching the schema.`;

  const userPrompt = `Domain: ${domainId}
Competency: ${competency.id} (${competency.title})
Category: ${competency.category}
Description: ${competency.description}
Difficulty (1-5): ${competency.difficulty}
Target Form Type: ${formType}

Prompts to strictly avoid (anti-leakage requirement):
${baselinePromptsToAvoid.length > 0 ? baselinePromptsToAvoid.map((p, i) => `${i + 1}. "${p}"`).join("\n") : "None provided"}

Generate a distinct assessment item with options (if multiple choice), exact correct answer, and explanation.`;

  try {
    const result = await aiGateway.generateStructured({
      task: "assessment",
      systemPrompt,
      userPrompt,
      promptVersion: ASSESSMENT_PROMPT_VERSION,
      schema: GeneratedAssessmentItemSchema,
      userId,
      temperature: 0.2,
    });

    const parsed = result.data;
    const generatedId = `gen-${formType.toLowerCase()}-${competency.id}-${Date.now().toString(36)}`;

    const assessmentItem: AssessmentItem = {
      id: generatedId,
      domainId,
      competencyId: competency.id,
      assessmentVersion: "v1",
      itemVersion: 1,
      itemType: parsed.itemType,
      difficulty: parsed.difficulty,
      prompt: parsed.prompt,
      options: parsed.options,
      correctAnswer: parsed.correctAnswer,
      explanation: parsed.explanation,
      formType,
      provenance: "AI_GENERATED",
      status: "ACTIVE",
      metadata: {
        modelUsed: result.model,
        promptVersion: result.promptVersion,
        generatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };

    return {
      success: true,
      item: assessmentItem,
      modelUsed: result.model,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: `Assessment generation failed: ${errorMessage}`,
    };
  }
}
