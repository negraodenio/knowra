import { z } from "zod";

export const DiagnosticItemTypeSchema = z.enum([
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "NUMERIC",
  "TRUE_FALSE",
]);
export type DiagnosticItemType = z.infer<typeof DiagnosticItemTypeSchema>;

export const DiagnosticItemSchema = z.object({
  id: z.string(),
  domainId: z.string(),
  competencyId: z.string(),
  prompt: z.string(),
  itemType: DiagnosticItemTypeSchema,
  difficulty: z.number().min(1).max(5),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string(),
  explanation: z.string().optional(),
  version: z.number().int().positive().default(1),
  provenance: z.enum(["CURATED", "AI_GENERATED"]).default("CURATED"),
  status: z.enum(["ACTIVE", "DRAFT", "DEPRECATED"]).default("ACTIVE"),
});
export type DiagnosticItem = z.infer<typeof DiagnosticItemSchema>;

export const DiagnosticSessionStatusSchema = z.enum([
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "ABANDONED",
]);
export type DiagnosticSessionStatus = z.infer<typeof DiagnosticSessionStatusSchema>;

export interface DiagnosticSession {
  id: string;
  userId: string;
  learningGoalId: string;
  domainId: string;
  mapVersion: string;
  status: DiagnosticSessionStatus;
  startedAt: string;
  completedAt?: string;
  overallBaselineScore?: number;
  itemIds: string[];
}

export interface DiagnosticResponse {
  id: string;
  sessionId: string;
  userId: string;
  itemId: string;
  competencyId: string;
  answer: string;
  isCorrect: boolean;
  score: number; // 0 to 100
  submittedAt: string;
}

export interface CompetencyBaselineResult {
  competencyId: string;
  baselineScore: number;
  confidence: number;
  evidenceCount: number;
  evaluations: Array<{
    itemId: string;
    score: number;
    isCorrect: boolean;
  }>;
}

export interface DiagnosticCompletionReport {
  sessionId: string;
  learningGoalId: string;
  domainId: string;
  mapVersion: string;
  overallBaselineScore: number;
  totalItems: number;
  completedItems: number;
  competencyBaselines: CompetencyBaselineResult[];
  relativeStrengths: string[];
  lowerBaselines: string[]; // Avoid calling "gaps" in S3 (§39)
}
