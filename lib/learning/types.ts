import { z } from "zod";

/**
 * Learning Outcome Taxonomies (§7)
 */
export const CompetencyCategorySchema = z.enum(["CONCEPTUAL", "PROCEDURAL", "FACTUAL"]);
export type CompetencyCategory = z.infer<typeof CompetencyCategorySchema>;

/**
 * Mastery States (§16)
 * 0–39   = CRITICAL
 * 40–59  = LOW
 * 60–74  = DEVELOPING
 * 75–89  = GOOD
 * 90–100 = MASTERY
 */
export const MasteryStateSchema = z.enum([
  "CRITICAL",
  "LOW",
  "DEVELOPING",
  "GOOD",
  "MASTERY",
]);
export type MasteryState = z.infer<typeof MasteryStateSchema>;

export function getMasteryState(score: number): MasteryState {
  if (score < 40) return "CRITICAL";
  if (score < 60) return "LOW";
  if (score < 75) return "DEVELOPING";
  if (score < 90) return "GOOD";
  return "MASTERY";
}

/**
 * Next Best Action Taxonomy (§20)
 */
export const NextBestActionSchema = z.enum([
  "LEARN",
  "PRACTICE",
  "FEYNMAN",
  "REVIEW",
  "REMEDIATE",
  "RETRY",
  "ADVANCE",
]);
export type NextBestAction = z.infer<typeof NextBestActionSchema>;

export const RecommendationStatusSchema = z.enum([
  "PENDING",
  "PRESENTED",
  "ACCEPTED",
  "SKIPPED",
  "COMPLETED",
  "EXPIRED",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

/**
 * Recommendation Output Schema (§13, §15, §19, §20)
 * Uses consistent 0–100 scale for priority score.
 */
export const RecommendationSchema = z.object({
  id: z.string().uuid().optional(),
  action: NextBestActionSchema,
  competencyId: z.string(),
  priority: z.number().min(0).max(100),
  reason: z.string().min(1),
  estimatedMinutes: z.number().positive(),
  status: RecommendationStatusSchema.default("PENDING"),
  algorithmVersion: z.string().default("v1"),
  generatedAt: z.string().datetime().optional(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const RecommendationEntitySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  learningGoalId: z.string().uuid(),
  competencyId: z.string(),
  action: NextBestActionSchema,
  priority: z.number().min(0).max(100),
  reason: z.string().min(1),
  estimatedMinutes: z.number().positive(),
  status: RecommendationStatusSchema,
  algorithmVersion: z.string().default("v1"),
  generatedAt: z.string().datetime(),
  presentedAt: z.string().datetime().optional(),
  acceptedAt: z.string().datetime().optional(),
  skippedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});
export type RecommendationEntity = z.infer<typeof RecommendationEntitySchema>;


/**
 * Evidence Model (§14, §15)
 */
export const EvidenceTypeSchema = z.enum([
  "DIAGNOSTIC",
  "EXERCISE",
  "PRACTICE",
  "FEYNMAN",
  "REVIEW",
  "APPLICATION",
  "BASELINE_ASSESSMENT",
  "FINAL_ASSESSMENT",
  "RETENTION_D7",
  "RETENTION_D30",
]);
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;

export const EvidenceRecordSchema = z.object({
  id: z.string().uuid().optional(),
  learnerId: z.string().uuid(),
  competencyId: z.string(),
  evidenceType: EvidenceTypeSchema,
  result: z.enum(["SUCCESS", "FAILURE", "PARTIAL"]),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  source: z.string(),
  timestamp: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  version: z.number().int().positive().default(1),
});
export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

/**
 * Competency Schema (§8)
 */
export const CompetencySchema = z.object({
  id: z.string(),
  domainId: z.string(),
  title: z.string(),
  description: z.string(),
  category: CompetencyCategorySchema,
  prerequisites: z.array(z.string()).default([]),
  difficulty: z.number().min(1).max(5).default(1),
  version: z.number().int().positive().default(1),
  status: z.enum(["DRAFT", "ACTIVE", "DEPRECATED"]).default("ACTIVE"),
  provenance: z.enum(["CURATED", "AI_GENERATED"]).default("CURATED"),
});
export type Competency = z.infer<typeof CompetencySchema>;
