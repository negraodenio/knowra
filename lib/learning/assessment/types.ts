import { z } from "zod";

export const AssessmentTypeSchema = z.enum([
  "BASELINE",
  "FINAL",
  "RETENTION_D7",
  "RETENTION_D30",
]);
export type AssessmentType = z.infer<typeof AssessmentTypeSchema>;

export const AssessmentItemTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "NUMERIC",
  "TRUE_FALSE",
]);
export type AssessmentItemType = z.infer<typeof AssessmentItemTypeSchema>;

export const AssessmentSessionStatusSchema = z.enum([
  "CREATED",
  "IN_PROGRESS",
  "SUBMITTED",
  "SCORED",
  "COMPLETED",
  "EXPIRED",
]);
export type AssessmentSessionStatus = z.infer<typeof AssessmentSessionStatusSchema>;

export const AssessmentBlueprintSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  competencyMapVersion: z.string().default("1.0.0"),
  assessmentType: AssessmentTypeSchema,
  targetCompetencies: z.array(z.string()).min(1),
  difficultyDistribution: z.object({
    easy: z.number().min(0).max(100),
    medium: z.number().min(0).max(100),
    hard: z.number().min(0).max(100),
  }).default({ easy: 30, medium: 50, hard: 20 }),
  itemCount: z.number().int().positive().default(5),
  passingThreshold: z.number().min(0).max(100).default(70.0),
  independenceRequirements: z.object({
    disallowBaselineItemIds: z.boolean().default(true),
    maxSemanticSimilarity: z.number().optional(),
  }).default({ disallowBaselineItemIds: true }),
  version: z.string().default("v1"),
  status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
  createdAt: z.string().datetime().optional(),
});
export type AssessmentBlueprint = z.infer<typeof AssessmentBlueprintSchema>;

export const AssessmentItemSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  competencyId: z.string(),
  assessmentVersion: z.string().default("v1").optional(),
  itemVersion: z.number().int().positive().default(1).optional(),
  version: z.string().optional(),
  itemType: AssessmentItemTypeSchema,
  difficulty: z.number().int().min(1).max(5),
  prompt: z.string().min(5),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  formType: AssessmentTypeSchema,
  provenance: z.enum(["CURATED", "AI_GENERATED"]).default("CURATED").optional(),
  status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE").optional(),
  metadata: z.record(z.string(), z.unknown()).default({}).optional(),
  createdAt: z.string().datetime().optional(),
});
export type AssessmentItem = z.infer<typeof AssessmentItemSchema>;

export interface AssessmentSession {
  id: string;
  userId: string;
  learningGoalId: string;
  domainId: string;
  blueprintId: string;
  assessmentType: AssessmentType;
  formVersion: string;
  status: AssessmentSessionStatus;
  overallScore?: number;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string;
  itemIds: string[];
  metadata?: Record<string, unknown>;
}

export interface AssessmentResponse {
  id: string;
  sessionId: string;
  userId: string;
  itemId: string;
  competencyId: string;
  answer: string;
  isCorrect: boolean;
  score: number; // 0 to 100
  responseTimeMs?: number;
  submittedAt: string;
}

export interface CompetencyAssessmentScore {
  competencyId: string;
  score: number; // 0 to 100
  totalItems: number;
  correctItems: number;
}

export interface AssessmentScoreResult {
  overallScore: number; // 0 to 100
  competencyScores: Record<string, CompetencyAssessmentScore>;
  itemEvaluations: Array<{
    itemId: string;
    competencyId: string;
    isCorrect: boolean;
    score: number;
  }>;
  scoringVersion: string;
}

export interface CompetencyGainResult {
  competencyId: string;
  baselineScore: number;
  finalScore: number;
  gain: number; // finalScore - baselineScore
  status: "LEARNED" | "UNCHANGED" | "REGRESSED";
}

export interface LearningGainReport {
  id?: string;
  learningGoalId: string;
  userId: string;
  domainId: string;
  baselineSessionId: string;
  baselineScore: number;
  finalSessionId: string;
  finalScore: number;
  learningGain: number; // absolute gain: finalScore - baselineScore
  relativeGain: number; // normalized gain: (final - baseline) / (100 - baseline)
  competencyGains: CompetencyGainResult[];
  calculatedAt: string;
}

export interface RetentionReport {
  id?: string;
  learningGoalId: string;
  userId: string;
  domainId: string;
  retentionType: "D7" | "D30";
  finalSessionId: string;
  retentionSessionId: string;
  baselineScore: number;
  finalScore: number;
  retentionScore: number;
  retentionRatio: number; // retentionScore / finalScore
  gainRetained: number; // retentionScore - baselineScore
  competencyRetention: Array<{
    competencyId: string;
    finalScore: number;
    retentionScore: number;
    ratio: number;
  }>;
  daysSinceFinal: number;
  measuredAt: string;
}
