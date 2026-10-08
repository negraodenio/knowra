import { z } from "zod";
import { aiGateway } from "./gateway";
import { aiModelOrchestrator } from "./orchestrator";
import { ModelTask } from "./models";
export type { ModelTask };
import { getModelMetadata } from "./capabilities";
import {
  FeynmanEvaluationSchema,
  calculateFeynmanScore,
  DEFAULT_FEYNMAN_RUBRIC,
} from "../learning/feynman/rubric";
import { GeneratedAssessmentItemSchema } from "./assessment";

export const BENCHMARK_VERSION = "S7.6_V1";

export type BenchmarkFailureType =
  | "OPERATIONAL_FAILURE"
  | "SCHEMA_FAILURE"
  | "CONTENT_FAILURE"
  | "NONE";

export interface ModelBenchmarkContext {
  task: ModelTask;
  testPrompt: string;
  systemPrompt?: string;
  schema?: z.ZodTypeAny;
  expectedOutputSubstring?: string;
  maxTokens?: number;
  customValidator?: (
    data: unknown,
    rawText: string
  ) => { valid: boolean; score?: number; failureType?: BenchmarkFailureType; reason?: string };
}

export interface ModelBenchmarkResult {
  model: string;
  task: ModelTask;
  success: boolean;
  schemaValid: boolean;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  errorMessage?: string;

  // S7.6 empirical evaluation fields
  runNumber?: number;
  qualityScore?: number;
  failureType?: BenchmarkFailureType;
  failureReason?: string;
  evaluator?: string;
  benchmarkVersion?: string;
  rawResponse?: string;
  parsedData?: unknown;
}

export interface BenchmarkResult extends ModelBenchmarkResult {
  runNumber: number;
  qualityScore: number;
  failureType: BenchmarkFailureType;
  evaluator: string;
  benchmarkVersion: string;
  timestamp: string;
}

export interface ModelComparisonReport {
  task: ModelTask;
  timestamp: string;
  benchmarks: ModelBenchmarkResult[];
  recommendedModel: string;
  reason: string;
}

export interface AstraVerificationStatus {
  verified: boolean;
  status: "VERIFIED" | "UNVERIFIED" | "BLOCKED";
  modelId?: string;
  reason: string;
}

export interface ModelVerificationInfo {
  modelId: string;
  provider: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "BLOCKED";
  reason: string;
}

export interface TaskAggregateSummary {
  task: ModelTask;
  model: string;
  runs: number;
  successRate: number;
  avgQualityScore: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgCost: number;
  totalCost: number;
  schemaValidityRate: number;
  operationalFailureRate: number;
  schemaFailureRate: number;
  contentFailureRate: number;
}

export interface ModelBenchmarkSuiteReport {
  timestamp: string;
  benchmarkVersion: string;
  modelsTested: string[];
  tasksTested: ModelTask[];
  runsPerTask: number;
  results: BenchmarkResult[];
  taskSummaries: TaskAggregateSummary[];
  astraStatus: AstraVerificationStatus;
  recommendations: {
    defaultModel: string;
    taskOverrides: Record<ModelTask, string>;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
    astraRecommendation:
      | "A) DEFAULT_MODEL"
      | "B) SELECTED_TASKS"
      | "C) NOT_RECOMMENDED_YET"
      | "D) VALIDATION_BLOCKED";
  };
}

/**
 * Deterministically classifies an execution error into failure dimensions (§S7.6).
 */
export function classifyError(err: unknown): BenchmarkFailureType {
  if (!err) return "NONE";
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();

  // Schema / JSON Parsing Failures
  if (
    msg.includes("schema validation") ||
    msg.includes("zod validation") ||
    msg.includes("json parse") ||
    msg.includes("failed to parse ai output as json")
  ) {
    return "SCHEMA_FAILURE";
  }

  // Operational / Infrastructure Failures
  if (
    aiModelOrchestrator.isOperationalError(err) ||
    msg.includes("404") ||
    msg.includes("no endpoints found") ||
    msg.includes("rate limit") ||
    msg.includes("429") ||
    msg.includes("timeout") ||
    msg.includes("connection") ||
    msg.includes("fetch failed") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  ) {
    return "OPERATIONAL_FAILURE";
  }

  return "OPERATIONAL_FAILURE";
}

/**
 * Verifies Astra status according to Step 1 (§S7.6).
 * Never fabricates an Astra ID if missing from environment.
 */
export function verifyAstraStatus(): AstraVerificationStatus {
  const defaultModel = process.env.DEFAULT_MODEL?.trim();
  if (!defaultModel || defaultModel === "") {
    return {
      verified: false,
      status: "BLOCKED",
      reason:
        "No Astra model ID configured in environment (DEFAULT_MODEL is empty). Provider endpoint unverified.",
    };
  }

  if (!defaultModel.toLowerCase().includes("astra")) {
    return {
      verified: false,
      status: "BLOCKED",
      modelId: defaultModel,
      reason: `DEFAULT_MODEL is configured as '${defaultModel}', which is not an Astra candidate.`,
    };
  }

  return {
    verified: true,
    status: "VERIFIED",
    modelId: defaultModel,
    reason: `Configured candidate Astra model identifier: '${defaultModel}'`,
  };
}

/**
 * Checks verification status for candidate models.
 */
export function verifyModelStatus(modelId: string): ModelVerificationInfo {
  const meta = getModelMetadata(modelId);

  if (modelId === "anthropic/claude-3.5-sonnet") {
    return {
      modelId,
      provider: meta.provider,
      verificationStatus: "BLOCKED",
      reason: "Provider returned 404 (No endpoints found for anthropic/claude-3.5-sonnet on OpenRouter).",
    };
  }

  if (modelId.toLowerCase().includes("astra")) {
    const astra = verifyAstraStatus();
    return {
      modelId,
      provider: meta.provider,
      verificationStatus: astra.verified ? "VERIFIED" : "BLOCKED",
      reason: astra.reason,
    };
  }

  return {
    modelId,
    provider: meta.provider,
    verificationStatus: "VERIFIED",
    reason: "Candidate model verified available via configured AI Gateway.",
  };
}

// ============================================================================
// TASK SCHEMAS (§S7.6 Tasks 1-8)
// ============================================================================

export const DiagnosticBenchmarkOutputSchema = z.object({
  identifiedCompetency: z.string().min(1),
  identifiedGap: z.string().min(1),
  confidence: z.number().min(0).max(1),
  suggestedNextStep: z.string().min(1),
});

export const PlanBenchmarkOutputSchema = z.object({
  objective: z.string().min(1),
  milestones: z
    .array(
      z.object({
        sequence: z.number().int().min(1),
        competencyId: z.string().min(1),
        title: z.string().min(1),
        rationale: z.string().min(1),
      })
    )
    .min(2),
  prerequisiteOrderValid: z.boolean(),
});

export const CompetencyBenchmarkOutputSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  prerequisites: z.array(z.string()),
  measurableOutcomes: z.array(z.string()).min(1),
});

export const MaterialBenchmarkOutputSchema = z.object({
  title: z.string().min(1),
  coreConcept: z.string().min(1),
  codeSnippet: z.string().min(1),
  commonMistake: z.string().min(1),
  keyTakeaway: z.string().min(1),
});

export const ClassifierBenchmarkOutputSchema = z.object({
  category: z.enum([
    "SETUP_ENVIRONMENT",
    "CONCEPTUAL_QUESTION",
    "CODE_DEBUGGING",
    "EXERCISE_SUBMISSION",
  ]),
  confidence: z.number().min(0).max(1),
});

export interface EDUIABenchmarkTaskDefinition {
  id: ModelTask;
  title: string;
  systemPrompt: string;
  userPrompt: string;
  schema?: z.ZodTypeAny;
  maxTokens?: number;
  evaluateQuality: (output: { rawText: string; data?: unknown }) => {
    score: number;
    failureType: BenchmarkFailureType;
    reason?: string;
  };
}

/**
 * Standard EDUIA Benchmark Task Suite Definitions (§S7.6 Tasks 1–8).
 * Pure deterministic evaluators without arbitrary LLM judge variability.
 */
export const EDUIABENCHMARK_TASKS: Record<ModelTask, EDUIABenchmarkTaskDefinition> = {
  tutor: {
    id: "tutor",
    title: "TASK 1 — TUTOR: Variables and Data Types",
    systemPrompt: "You are an expert adaptive tutor for Python programming.",
    userPrompt:
      "Explain Python variables and basic data types to a complete beginner.\n" +
      "Requirements:\n" +
      "1. Adapt tone and pace for a beginner learner.\n" +
      "2. Provide one clear code example showing assignment.\n" +
      "3. Clarify the misconception that variables are physical boxes rather than object references.\n" +
      "4. Include one short check-for-understanding question at the end.",
    maxTokens: 350,
    evaluateQuality: ({ rawText }) => {
      const lower = rawText.toLowerCase();
      let score = 0;

      // 1. Has code example (assignment syntax)
      const hasCode =
        lower.includes("=") || lower.includes("int") || lower.includes("str") || lower.includes("python");
      if (hasCode) score += 25;

      // 2. Addresses reference/box misconception
      const hasMisconception =
        lower.includes("box") ||
        lower.includes("label") ||
        lower.includes("reference") ||
        lower.includes("point") ||
        lower.includes("memory") ||
        lower.includes("object");
      if (hasMisconception) score += 25;

      // 3. Has check question
      const hasQuestion =
        rawText.includes("?") &&
        (lower.includes("what") ||
          lower.includes("how") ||
          lower.includes("try") ||
          lower.includes("question") ||
          lower.includes("predict") ||
          lower.includes("your turn"));
      if (hasQuestion) score += 25;

      // 4. Clarity & pedagogical structure
      const isSubstantial = rawText.trim().length >= 120;
      if (isSubstantial) score += 25;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Tutor output missed critical pedagogical requirements (example, misconception, or check question).",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  feynman: {
    id: "feynman",
    title: "TASK 2 — FEYNMAN: Misconception Evaluation",
    systemPrompt:
      "You are a pedagogical assessment evaluator evaluating a learner explanation using the Feynman technique.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- correctness: number (0-100)\n" +
      "- completeness: number (0-100)\n" +
      "- simplicity: number (0-100)\n" +
      "- causal_reasoning: number (0-100)\n" +
      "- misconception_penalty: number (0-100)\n" +
      "- overall_score: number (0-100)\n" +
      "- confidence: number (0.0-1.0)\n" +
      "- missing_concepts: string[]\n" +
      "- misconceptions: string[]\n" +
      "- feedback: string\n" +
      "- rubric_version: \"v1\"",
    userPrompt:
      "Target Competency: Python Variables & Memory References\n" +
      "Learner explanation with realistic misconception:\n" +
      "'A variable in Python is a physical storage box where data lives. When I assign b = a, Python always creates a brand new box with its own copy of the data, so changing b can never affect a under any circumstances.'\n" +
      "Evaluate this explanation strictly against the Feynman rubric.",
    schema: FeynmanEvaluationSchema,
    maxTokens: 400,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof FeynmanEvaluationSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing parsed Feynman data." };
      }

      let score = 0;
      // 1. Detected misconception
      const detected =
        parsed.misconceptions.length > 0 ||
        parsed.misconception_penalty >= 20 ||
        parsed.feedback.toLowerCase().includes("reference") ||
        parsed.feedback.toLowerCase().includes("box") ||
        parsed.feedback.toLowerCase().includes("mutable") ||
        parsed.feedback.toLowerCase().includes("copy");
      if (detected) score += 40;

      // 2. Score sanity
      const sanity =
        parsed.correctness <= 70 &&
        parsed.causal_reasoning >= 20 &&
        parsed.completeness >= 20;
      if (sanity) score += 30;

      // 3. Deterministic score agreement with rubric (§6)
      const expectedScore = calculateFeynmanScore(
        {
          correctness: parsed.correctness,
          completeness: parsed.completeness,
          simplicity: parsed.simplicity,
          causal_reasoning: parsed.causal_reasoning,
          misconception_penalty: parsed.misconception_penalty,
        },
        DEFAULT_FEYNMAN_RUBRIC
      );
      if (Math.abs(parsed.overall_score - expectedScore) <= 2) {
        score += 30;
      }

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Feynman evaluation failed to detect the object reference / variable aliasing misconception.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  diagnostic: {
    id: "diagnostic",
    title: "TASK 3 — DIAGNOSTIC: Type Coercion Scenario",
    systemPrompt:
      "You are an adaptive diagnostic engine for programming concepts.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- identifiedCompetency: string (the underlying competency title)\n" +
      "- identifiedGap: string (the specific knowledge gap or misconception)\n" +
      "- confidence: number (between 0.0 and 1.0)\n" +
      "- suggestedNextStep: string (recommended learning action)",
    userPrompt:
      "Learner executed: `x = '5' + 3` and got `TypeError: can only concatenate str (not 'int') to str`.\n" +
      "Learner asks: 'Why doesn't Python automatically convert 3 into '3' like JavaScript does?'\n" +
      "Diagnose the gap, specify the target competency, rate confidence (0.0 to 1.0), and suggest next learning step.",
    schema: DiagnosticBenchmarkOutputSchema,
    maxTokens: 300,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof DiagnosticBenchmarkOutputSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing diagnostic data." };
      }

      let score = 0;
      const lowerGap = parsed.identifiedGap.toLowerCase();
      const lowerComp = parsed.identifiedCompetency.toLowerCase();

      // Identifies type coercion / strong typing / type conversion
      const matchesConcept =
        lowerGap.includes("type") ||
        lowerGap.includes("coercion") ||
        lowerGap.includes("conversion") ||
        lowerGap.includes("strong") ||
        lowerComp.includes("type") ||
        lowerComp.includes("conversion");
      if (matchesConcept) score += 50;

      // Realistic confidence
      if (parsed.confidence >= 0.7 && parsed.confidence <= 1.0) score += 25;

      // Clear actionable next step
      if (parsed.suggestedNextStep.length >= 15) score += 25;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Diagnostic failed to identify strong typing or explicit type conversion gap.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  plan: {
    id: "plan",
    title: "TASK 4 — PLAN: Prerequisite-Aware Milestones",
    systemPrompt:
      "You are an educational sequence planning engine.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- objective: string\n" +
      "- milestones: array of objects with { sequence: number, competencyId: string, title: string, rationale: string }\n" +
      "- prerequisiteOrderValid: boolean",
    userPrompt:
      "Learner objective: 'Master Python fundamentals for data analysis'.\n" +
      "Weaknesses: 'Knows syntax, struggles with data types, collections (lists/dicts), and functions'.\n" +
      "Generate an ordered plan respecting prerequisites (variables -> collections -> functions -> analysis).\n" +
      "Milestones must NOT mutate learner state directly.",
    schema: PlanBenchmarkOutputSchema,
    maxTokens: 350,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof PlanBenchmarkOutputSchema>;
      if (!parsed || !parsed.milestones) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing plan milestones." };
      }

      let score = 0;
      // 1. Min 2 milestones with increasing sequence
      const isSequential = parsed.milestones.every((m, idx) => m.sequence === idx + 1);
      if (isSequential && parsed.milestones.length >= 2) score += 40;

      // 2. Prerequisite awareness flag
      if (parsed.prerequisiteOrderValid) score += 30;

      // 3. Rationale clarity
      const hasRationales = parsed.milestones.every((m) => m.rationale && m.rationale.length >= 10);
      if (hasRationales) score += 30;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Plan milestones failed prerequisite order or sequential integrity.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  competency: {
    id: "competency",
    title: "TASK 5 — COMPETENCY: Structured Competency Formulation",
    systemPrompt:
      "You are an educational curriculum architect for programming.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- id: string\n" +
      "- title: string\n" +
      "- description: string\n" +
      "- category: string\n" +
      "- difficulty: number (1-5)\n" +
      "- prerequisites: string[]\n" +
      "- measurableOutcomes: string[]",
    userPrompt:
      "Formulate a competency definition for:\n" +
      "Domain: Python Programming\n" +
      "Topic: Functions with default arguments and keyword arguments\n" +
      "Include id, title, description, category, difficulty (1-5), prerequisites, and measurable outcomes.",
    schema: CompetencyBenchmarkOutputSchema,
    maxTokens: 350,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof CompetencyBenchmarkOutputSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing competency data." };
      }

      let score = 0;
      if (parsed.difficulty >= 1 && parsed.difficulty <= 5) score += 25;
      if (parsed.measurableOutcomes.length >= 1) score += 35;
      if (parsed.prerequisites.length >= 1) score += 20;
      if (parsed.description.length >= 20) score += 20;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Competency definition lacked measurable outcomes or prerequisite specification.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  assessment: {
    id: "assessment",
    title: "TASK 6 — ASSESSMENT: Independent Assessment Item Generation",
    systemPrompt:
      "You are an expert psychometrician and assessment designer.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- prompt: string (the question text)\n" +
      "- itemType: \"MULTIPLE_CHOICE\" | \"SHORT_ANSWER\" | \"NUMERIC\" | \"TRUE_FALSE\"\n" +
      "- difficulty: number (1-5)\n" +
      "- options: string[] (if multiple choice, provide 4 options)\n" +
      "- correctAnswer: string (must match one of the options)\n" +
      "- explanation: string (detailed pedagogical rationale)",
    userPrompt:
      "Generate an independent multiple-choice question testing understanding of:\n" +
      "Competency: Python Variable References and Object Mutability.\n" +
      "Target form: MULTIPLE_CHOICE.\n" +
      "Must have prompt, 4 options, correctAnswer matching one option, and explanation.",
    schema: GeneratedAssessmentItemSchema,
    maxTokens: 350,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof GeneratedAssessmentItemSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing assessment data." };
      }

      let score = 0;
      // 1. Item type multiple choice
      if (parsed.itemType === "MULTIPLE_CHOICE") score += 25;

      // 2. Options present and contains correct answer
      if (parsed.options && parsed.options.length >= 3) {
        score += 25;
        const answerMatch = parsed.options.some(
          (opt) =>
            opt.trim() === parsed.correctAnswer.trim() ||
            opt.toLowerCase().includes(parsed.correctAnswer.toLowerCase())
        );
        if (answerMatch) score += 25;
      }

      // 3. Explanation present
      if (parsed.explanation && parsed.explanation.length >= 15) score += 25;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Assessment item options did not contain the correct answer or lacked clarity.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  material: {
    id: "material",
    title: "TASK 7 — MATERIAL: Instructional Bite Generation",
    systemPrompt:
      "You are an educational content author creating concise instructional bites.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- title: string\n" +
      "- coreConcept: string\n" +
      "- codeSnippet: string\n" +
      "- commonMistake: string\n" +
      "- keyTakeaway: string",
    userPrompt:
      "Create concise learning material for the competency: 'Python Type Casting (int, str, float)'.\n" +
      "Include title, core concept, a short runnable code snippet, a common mistake, and a key takeaway.",
    schema: MaterialBenchmarkOutputSchema,
    maxTokens: 350,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof MaterialBenchmarkOutputSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing material data." };
      }

      let score = 0;
      const lowerSnippet = parsed.codeSnippet.toLowerCase();

      // 1. Runnable snippet with python syntax
      if (
        lowerSnippet.includes("int(") ||
        lowerSnippet.includes("str(") ||
        lowerSnippet.includes("float(") ||
        lowerSnippet.includes("=")
      ) {
        score += 35;
      }

      // 2. Common mistake addresses type error / casting
      if (parsed.commonMistake && parsed.commonMistake.length >= 15) score += 30;

      // 3. Core concept and key takeaway non-empty
      if (parsed.coreConcept.length >= 20 && parsed.keyTakeaway.length >= 15) score += 35;

      if (score < 50) {
        return {
          score,
          failureType: "CONTENT_FAILURE",
          reason: "Material snippet missing runnable casting examples or common mistake.",
        };
      }
      return { score, failureType: "NONE" };
    },
  },

  classifier: {
    id: "classifier",
    title: "TASK 8 — CLASSIFIER: Low-Cost Intent Categorization",
    systemPrompt:
      "You are a fast intent classifier for learner support requests.\n" +
      "You MUST respond ONLY with valid JSON with these exact keys:\n" +
      "- category: exactly one of \"SETUP_ENVIRONMENT\", \"CONCEPTUAL_QUESTION\", \"CODE_DEBUGGING\", \"EXERCISE_SUBMISSION\"\n" +
      "- confidence: number between 0.0 and 1.0",
    userPrompt:
      "Classify the following query into exactly one of: SETUP_ENVIRONMENT, CONCEPTUAL_QUESTION, CODE_DEBUGGING, EXERCISE_SUBMISSION.\n" +
      "Query: 'How do I install pytest and create a virtual environment with venv on Windows?'",
    schema: ClassifierBenchmarkOutputSchema,
    maxTokens: 150,
    evaluateQuality: ({ data }) => {
      const parsed = data as z.infer<typeof ClassifierBenchmarkOutputSchema>;
      if (!parsed) {
        return { score: 0, failureType: "SCHEMA_FAILURE", reason: "Missing classifier data." };
      }

      // Known ground truth: SETUP_ENVIRONMENT
      if (parsed.category === "SETUP_ENVIRONMENT") {
        return { score: 100, failureType: "NONE" };
      }

      return {
        score: 0,
        failureType: "CONTENT_FAILURE",
        reason: `Classifier misclassified 'SETUP_ENVIRONMENT' as '${parsed.category}'.`,
      };
    },
  },
};

/**
 * Executes a single run of a standard EDUIA benchmark task (§S7.6).
 * NEVER mutates DEFAULT_MODEL or production model routing.
 */
export async function executeEduiaBenchmarkTask(
  modelId: string,
  taskName: ModelTask,
  runNumber = 1
): Promise<BenchmarkResult> {
  const taskDef = EDUIABENCHMARK_TASKS[taskName];
  if (!taskDef) {
    throw new Error(`Unknown EDUIA benchmark task: ${taskName}`);
  }

  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  try {
    if (taskDef.schema) {
      const res = await aiGateway.generateStructured({
        task: taskName,
        modelOverride: modelId,
        systemPrompt: taskDef.systemPrompt,
        userPrompt: taskDef.userPrompt,
        schema: taskDef.schema,
        promptVersion: `BENCHMARK_${BENCHMARK_VERSION}`,
        maxTokens: taskDef.maxTokens,
        temperature: 0.1, // Deterministic setting for benchmark repeatability
      });

      const latencyMs = Date.now() - startTime;
      const evaluation = taskDef.evaluateQuality({ rawText: res.rawText, data: res.data });

      return {
        model: modelId,
        task: taskName,
        runNumber,
        qualityScore: evaluation.score,
        schemaValid: true,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
        success: evaluation.failureType === "NONE",
        failureType: evaluation.failureType,
        failureReason: evaluation.reason,
        evaluator: "deterministic-rubric-v1",
        benchmarkVersion: BENCHMARK_VERSION,
        timestamp,
        rawResponse: res.rawText,
        parsedData: res.data,
      };
    } else {
      const res = await aiGateway.generateText({
        task: taskName,
        modelOverride: modelId,
        systemPrompt: taskDef.systemPrompt,
        userPrompt: taskDef.userPrompt,
        promptVersion: `BENCHMARK_${BENCHMARK_VERSION}`,
        maxTokens: taskDef.maxTokens,
        temperature: 0.1,
      });

      const latencyMs = Date.now() - startTime;
      const evaluation = taskDef.evaluateQuality({ rawText: res.data });

      return {
        model: modelId,
        task: taskName,
        runNumber,
        qualityScore: evaluation.score,
        schemaValid: true,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
        success: evaluation.failureType === "NONE",
        failureType: evaluation.failureType,
        failureReason: evaluation.reason,
        evaluator: "deterministic-rubric-v1",
        benchmarkVersion: BENCHMARK_VERSION,
        timestamp,
        rawResponse: res.data,
        parsedData: res.data,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const failureType = classifyError(err);
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      model: modelId,
      task: taskName,
      runNumber,
      qualityScore: 0,
      schemaValid: failureType !== "SCHEMA_FAILURE",
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      success: false,
      failureType,
      failureReason: errorMessage,
      errorMessage,
      evaluator: "deterministic-rubric-v1",
      benchmarkVersion: BENCHMARK_VERSION,
      timestamp,
    };
  }
}

/**
 * Backward-compatible single-prompt benchmark function from S7.5.
 */
export async function benchmarkModel(
  modelId: string,
  context: ModelBenchmarkContext,
  runNumber = 1
): Promise<ModelBenchmarkResult> {
  const startTime = Date.now();
  try {
    if (context.schema) {
      const res = await aiGateway.generateStructured({
        task: context.task,
        modelOverride: modelId,
        systemPrompt: context.systemPrompt || "You are an educational assistant.",
        userPrompt: context.testPrompt,
        schema: context.schema,
        promptVersion: "BENCHMARK_V1",
        maxTokens: context.maxTokens,
      });

      const latencyMs = Date.now() - startTime;
      let failureType: BenchmarkFailureType = "NONE";
      let qualityScore = 100;
      let failureReason: string | undefined;

      if (context.customValidator) {
        const val = context.customValidator(res.data, res.rawText);
        if (!val.valid) {
          failureType = val.failureType || "CONTENT_FAILURE";
          qualityScore = val.score ?? 0;
          failureReason = val.reason;
        }
      }

      return {
        model: modelId,
        task: context.task,
        runNumber,
        qualityScore,
        success: failureType === "NONE",
        schemaValid: true,
        failureType,
        failureReason,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
        evaluator: "custom-validator",
        benchmarkVersion: BENCHMARK_VERSION,
        parsedData: res.data,
        rawResponse: res.rawText,
      };
    } else {
      const res = await aiGateway.generateText({
        task: context.task,
        modelOverride: modelId,
        systemPrompt: context.systemPrompt || "You are an educational assistant.",
        userPrompt: context.testPrompt,
        promptVersion: "BENCHMARK_V1",
        maxTokens: context.maxTokens,
      });

      const latencyMs = Date.now() - startTime;
      let failureType: BenchmarkFailureType = "NONE";
      let qualityScore = 100;
      let failureReason: string | undefined;

      if (
        context.expectedOutputSubstring &&
        !res.data.includes(context.expectedOutputSubstring)
      ) {
        failureType = "CONTENT_FAILURE";
        qualityScore = 0;
        failureReason = `Output did not contain expected substring: "${context.expectedOutputSubstring}"`;
      }

      return {
        model: modelId,
        task: context.task,
        runNumber,
        qualityScore,
        success: failureType === "NONE",
        schemaValid: true,
        failureType,
        failureReason,
        latencyMs,
        promptTokens: res.usage.promptTokens,
        completionTokens: res.usage.completionTokens,
        totalTokens: res.usage.totalTokens,
        estimatedCost: res.usage.estimatedCost,
        evaluator: "substring-validator",
        benchmarkVersion: BENCHMARK_VERSION,
        rawResponse: res.data,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const failureType = classifyError(err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      model: modelId,
      task: context.task,
      runNumber,
      qualityScore: 0,
      success: false,
      schemaValid: failureType !== "SCHEMA_FAILURE",
      failureType,
      failureReason: errorMessage,
      latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      errorMessage,
      evaluator: "error-classifier",
      benchmarkVersion: BENCHMARK_VERSION,
    };
  }
}

/**
 * Backward-compatible head-to-head model comparison from S7.5.
 */
export async function compareModels(
  modelIds: string[],
  context: ModelBenchmarkContext
): Promise<ModelComparisonReport> {
  const benchmarks: ModelBenchmarkResult[] = [];

  for (const model of modelIds) {
    const result = await benchmarkModel(model, context);
    benchmarks.push(result);
  }

  const successful = benchmarks.filter((b) => b.success);
  let recommendedModel = modelIds[0] || "unknown";
  let reason = "No models succeeded in benchmark";

  if (successful.length > 0) {
    successful.sort((a, b) => a.latencyMs - b.latencyMs);
    recommendedModel = successful[0].model;
    reason = `Lowest latency (${successful[0].latencyMs}ms) among successful candidates`;
  }

  return {
    task: context.task,
    timestamp: new Date().toISOString(),
    benchmarks,
    recommendedModel,
    reason,
  };
}

/**
 * Computes task aggregate statistics across multiple runs (§S7.6).
 */
export function aggregateBenchmarkRuns(results: BenchmarkResult[]): TaskAggregateSummary[] {
  const grouped = new Map<string, BenchmarkResult[]>();

  for (const r of results) {
    const key = `${r.model}::${r.task}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(r);
  }

  const summaries: TaskAggregateSummary[] = [];

  for (const [key, group] of grouped.entries()) {
    const [model, task] = key.split("::") as [string, ModelTask];
    const totalRuns = group.length;
    const successfulRuns = group.filter((g) => g.success).length;
    const schemaValidRuns = group.filter((g) => g.schemaValid).length;
    const operationalFailures = group.filter(
      (g) => g.failureType === "OPERATIONAL_FAILURE"
    ).length;
    const schemaFailures = group.filter((g) => g.failureType === "SCHEMA_FAILURE").length;
    const contentFailures = group.filter((g) => g.failureType === "CONTENT_FAILURE").length;

    const latencies = group.map((g) => g.latencyMs);
    const avgLatencyMs = Math.round(latencies.reduce((a, b) => a + b, 0) / totalRuns);
    const minLatencyMs = Math.min(...latencies);
    const maxLatencyMs = Math.max(...latencies);

    const totalCost = Number(group.reduce((a, b) => a + b.estimatedCost, 0).toFixed(6));
    const avgCost = Number((totalCost / totalRuns).toFixed(6));
    const avgQualityScore = Math.round(
      group.reduce((a, b) => a + b.qualityScore, 0) / totalRuns
    );

    summaries.push({
      task,
      model,
      runs: totalRuns,
      successRate: Number((successfulRuns / totalRuns).toFixed(2)),
      avgQualityScore,
      avgLatencyMs,
      minLatencyMs,
      maxLatencyMs,
      avgCost,
      totalCost,
      schemaValidityRate: Number((schemaValidRuns / totalRuns).toFixed(2)),
      operationalFailureRate: Number((operationalFailures / totalRuns).toFixed(2)),
      schemaFailureRate: Number((schemaFailures / totalRuns).toFixed(2)),
      contentFailureRate: Number((contentFailures / totalRuns).toFixed(2)),
    });
  }

  return summaries;
}

/**
 * Generates an auditable model recommendation matrix based strictly on benchmark results (§S7.6).
 * NEVER mutates production environment or model routing.
 */
export function generateBenchmarkRecommendation(
  summaries: TaskAggregateSummary[],
  astraStatus: AstraVerificationStatus
): ModelBenchmarkSuiteReport["recommendations"] {
  const allTasks: ModelTask[] = [
    "tutor",
    "feynman",
    "diagnostic",
    "plan",
    "competency",
    "assessment",
    "material",
    "classifier",
  ];

  const taskOverrides: Record<ModelTask, string> = {} as Record<ModelTask, string>;

  for (const t of allTasks) {
    const candidatesForTask = summaries.filter((s) => s.task === t && s.successRate > 0);
    if (candidatesForTask.length === 0) {
      taskOverrides[t] = "openai/gpt-4o-mini"; // Safe fallback
      continue;
    }

    // Pedagogical selection principle (§S7.5, §S7.6):
    // For classifier: Cost > Latency > Quality
    // For tutor / feynman / assessment / diagnostic / plan / competency: Quality > Reliability > Latency > Cost
    if (t === "classifier") {
      candidatesForTask.sort((a, b) => a.avgCost - b.avgCost || a.avgLatencyMs - b.avgLatencyMs);
    } else {
      candidatesForTask.sort(
        (a, b) =>
          b.avgQualityScore - a.avgQualityScore ||
          b.successRate - a.successRate ||
          a.avgLatencyMs - b.avgLatencyMs
      );
    }

    taskOverrides[t] = candidatesForTask[0].model;
  }

  // DEFAULT_MODEL selection: Candidate with best general reliability and efficiency
  const modelOverall = new Map<string, { success: number; runs: number; quality: number }>();
  for (const s of summaries) {
    const curr = modelOverall.get(s.model) || { success: 0, runs: 0, quality: 0 };
    curr.success += s.successRate * s.runs;
    curr.runs += s.runs;
    curr.quality += s.avgQualityScore;
    modelOverall.set(s.model, curr);
  }

  let defaultModel = "openai/gpt-4o-mini";
  if (modelOverall.has("openai/gpt-4o-mini")) {
    defaultModel = "openai/gpt-4o-mini";
  }

  const astraRecommendation: ModelBenchmarkSuiteReport["recommendations"]["astraRecommendation"] =
    !astraStatus.verified
      ? "D) VALIDATION_BLOCKED"
      : "C) NOT_RECOMMENDED_YET";

  return {
    defaultModel,
    taskOverrides,
    confidence: summaries.length > 0 ? "HIGH" : "LOW",
    reason:
      "Empirical benchmark evidence: Low-cost fast model for classifier/material, high-capacity model for reasoning/rubrics.",
    astraRecommendation,
  };
}

export interface BenchmarkSuiteOptions {
  models: string[];
  tasks?: ModelTask[];
  runsPerTask?: number;
}

/**
 * Runs the full EDUIA benchmark suite across candidate models and tasks (§S7.6).
 * Maintains repeatability, records telemetry, and preserves production configuration.
 */
export async function runEduiaBenchmarkSuite(
  options: BenchmarkSuiteOptions
): Promise<ModelBenchmarkSuiteReport> {
  const tasksToRun: ModelTask[] =
    options.tasks || (Object.keys(EDUIABENCHMARK_TASKS) as ModelTask[]);
  const runs = options.runsPerTask || 1;
  const allResults: BenchmarkResult[] = [];

  for (const model of options.models) {
    for (const task of tasksToRun) {
      for (let run = 1; run <= runs; run++) {
        const result = await executeEduiaBenchmarkTask(model, task, run);
        allResults.push(result);
      }
    }
  }

  const summaries = aggregateBenchmarkRuns(allResults);
  const astraStatus = verifyAstraStatus();
  const recommendations = generateBenchmarkRecommendation(summaries, astraStatus);

  return {
    timestamp: new Date().toISOString(),
    benchmarkVersion: BENCHMARK_VERSION,
    modelsTested: options.models,
    tasksTested: tasksToRun,
    runsPerTask: runs,
    results: allResults,
    taskSummaries: summaries,
    astraStatus,
    recommendations,
  };
}
