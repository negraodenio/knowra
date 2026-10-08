import { CompetencyCategory, EvidenceRecord, EvidenceType, getMasteryState, MasteryState } from "./types";

export const MASTERY_ALGORITHM_VERSION = "v1";

/**
 * Category-Specific Weight Configurations (§7)
 * Implemented as versioned, configurable structures rather than hardcoded scattered constants.
 */
export interface CategoryWeights {
  diagnostic?: number;
  exercise?: number;
  feynman?: number;
  review?: number;
  application?: number;
}

export const DEFAULT_CATEGORY_WEIGHTS: Record<CompetencyCategory, CategoryWeights> = {
  CONCEPTUAL: {
    exercise: 0.40,
    feynman: 0.25,
    review: 0.20,
    diagnostic: 0.15,
  },
  PROCEDURAL: {
    application: 0.55,
    exercise: 0.20,
    review: 0.15,
    diagnostic: 0.10,
  },
  FACTUAL: {
    exercise: 0.60,
    review: 0.30,
    diagnostic: 0.10,
  },
};

export interface RecencyConfig {
  halfLifeDays: number; // Age in days at which evidence weight is halved (default: 45 days)
}

export const DEFAULT_RECENCY_CONFIG: RecencyConfig = {
  halfLifeDays: 45,
};

export interface MasteryCalculationOutput {
  competencyId: string;
  category: CompetencyCategory;
  masteryScore: number;
  masteryState: MasteryState;
  confidenceScore: number;
  evidenceCount: number;
  evidenceTypes: EvidenceType[];
  calculationVersion: string;
  calculatedAt: string;
  componentScores: Record<
    string,
    { rawScore: number; configuredWeight: number; normalizedWeight: number }
  >;
}

/**
 * Calculates exponential recency weight (§11, §41)
 * recency_weight = exp(-lambda * ageInDays)
 * Historical evidence is never modified; only its weight in current calculation decays.
 */
export function calculateRecencyWeight(
  evidenceTimestamp: string | undefined,
  referenceDate: Date = new Date(),
  config: RecencyConfig = DEFAULT_RECENCY_CONFIG
): number {
  if (!evidenceTimestamp) return 1.0;

  const evDate = new Date(evidenceTimestamp);
  const diffMs = referenceDate.getTime() - evDate.getTime();
  const ageInDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

  const lambda = Math.LN2 / config.halfLifeDays;
  return Math.exp(-lambda * ageInDays);
}

/**
 * Maps EvidenceType enum string to weight component key.
 */
function mapEvidenceTypeToKey(type: EvidenceType): keyof CategoryWeights | null {
  switch (type) {
    case "DIAGNOSTIC":
    case "BASELINE_ASSESSMENT":
      return "diagnostic";
    case "EXERCISE":
    case "PRACTICE":
      return "exercise";
    case "FEYNMAN":
      return "feynman";
    case "REVIEW":
    case "RETENTION_D7":
    case "RETENTION_D30":
      return "review";
    case "APPLICATION":
    case "FINAL_ASSESSMENT":
      return "application";
    default:
      return null;
  }
}

/**
 * Calculates evidence confidence (§12, §13, §14, §15, §40)
 * Evaluates evidence volume, diversity across types, consistency, and recency.
 * Strictly separates confidence from mastery.
 */
export function calculateEvidenceConfidence(
  evidenceList: EvidenceRecord[],
  referenceDate: Date = new Date(),
  recencyConfig: RecencyConfig = DEFAULT_RECENCY_CONFIG
): number {
  const count = evidenceList.length;
  if (count === 0) return 0.0;

  // Single evidence item hard ceiling (§15, §51)
  if (count === 1) {
    const singleRecency = calculateRecencyWeight(evidenceList[0].timestamp, referenceDate, recencyConfig);
    return Number(Math.min(0.40, 0.40 * singleRecency).toFixed(3));
  }

  // 1. Volume Factor
  let volumeBase = 0.50;
  if (count === 2) volumeBase = 0.60;
  else if (count === 3) volumeBase = 0.72;
  else if (count >= 4) volumeBase = Math.min(0.90, 0.72 + (count - 3) * 0.05);

  // 2. Diversity Factor (§40)
  const distinctTypes = new Set(evidenceList.map((e) => e.evidenceType));
  let diversityMultiplier = 0.85; // Single type penalty
  if (distinctTypes.size === 2) diversityMultiplier = 1.00;
  else if (distinctTypes.size >= 3) diversityMultiplier = 1.15;

  // 3. Consistency Factor (penalty for conflicting evidence §14, §51)
  const scores = evidenceList.map((e) => e.score);
  const mean = scores.reduce((a, b) => a + b, 0) / count;
  const variance = scores.reduce((acc, s) => acc + Math.pow(s - mean, 2), 0) / count;
  const stdDev = Math.sqrt(variance);

  // Standard deviation penalty: stdDev of 0 => 1.0, stdDev of 40 => 0.55
  const consistencyMultiplier = Math.max(0.50, 1.0 - (stdDev / 100) * 1.1);

  // 4. Mean Recency Factor
  const recencyWeights = evidenceList.map((e) =>
    calculateRecencyWeight(e.timestamp, referenceDate, recencyConfig)
  );
  const avgRecency = recencyWeights.reduce((a, b) => a + b, 0) / count;

  let rawConfidence = volumeBase * diversityMultiplier * consistencyMultiplier * avgRecency;

  // Ceiling Rules (§15)
  if (count === 2) {
    rawConfidence = Math.min(0.65, rawConfidence);
  } else {
    rawConfidence = Math.min(0.95, rawConfidence);
  }

  return Number(Math.max(0.05, rawConfidence).toFixed(3));
}

/**
 * Pure Mastery Engine (§5, §7, §8, §10, §43)
 * Deterministically computes current mastery score, confidence, and state.
 */
export function calculateMastery(
  competencyId: string,
  category: CompetencyCategory,
  evidenceList: EvidenceRecord[],
  options?: {
    customWeights?: CategoryWeights;
    recencyConfig?: RecencyConfig;
    referenceDate?: Date;
  }
): MasteryCalculationOutput {
  const referenceDate = options?.referenceDate || new Date();
  const recencyConfig = options?.recencyConfig || DEFAULT_RECENCY_CONFIG;
  const weightsConfig = options?.customWeights || DEFAULT_CATEGORY_WEIGHTS[category];
  const calculatedAt = referenceDate.toISOString();

  // If no evidence is present:
  if (evidenceList.length === 0) {
    return {
      competencyId,
      category,
      masteryScore: 0,
      masteryState: "CRITICAL",
      confidenceScore: 0,
      evidenceCount: 0,
      evidenceTypes: [],
      calculationVersion: MASTERY_ALGORITHM_VERSION,
      calculatedAt,
      componentScores: {},
    };
  }

  // Group evidence by formula component key
  const groupedEvidence: Partial<Record<keyof CategoryWeights, EvidenceRecord[]>> = {};

  for (const ev of evidenceList) {
    const key = mapEvidenceTypeToKey(ev.evidenceType);
    if (!key) continue;
    if (!groupedEvidence[key]) groupedEvidence[key] = [];
    groupedEvidence[key]!.push(ev);
  }

  // Aggregate each component using recency-weighted mean (§10, §11)
  const aggregatedComponents: Partial<Record<keyof CategoryWeights, number>> = {};

  for (const [keyStr, evs] of Object.entries(groupedEvidence)) {
    const key = keyStr as keyof CategoryWeights;
    if (!evs || evs.length === 0) continue;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const ev of evs) {
      const rw = calculateRecencyWeight(ev.timestamp, referenceDate, recencyConfig);
      weightedSum += ev.score * rw;
      totalWeight += rw;
    }

    aggregatedComponents[key] = totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  // Renormalize available evidence (§8, §49)
  // Only components with actual observations participate in formula weighting
  const availableKeys = Object.keys(aggregatedComponents) as Array<keyof CategoryWeights>;
  const activeKeys = availableKeys.filter((k) => (weightsConfig[k] ?? 0) > 0);

  if (activeKeys.length === 0) {
    // Evidence existed but did not match category configuration
    const fallbackScore = Number(
      (evidenceList.reduce((acc, e) => acc + e.score, 0) / evidenceList.length).toFixed(2)
    );
    const confidence = calculateEvidenceConfidence(evidenceList, referenceDate, recencyConfig);
    return {
      competencyId,
      category,
      masteryScore: fallbackScore,
      masteryState: getMasteryState(fallbackScore),
      confidenceScore: confidence,
      evidenceCount: evidenceList.length,
      evidenceTypes: Array.from(new Set(evidenceList.map((e) => e.evidenceType))),
      calculationVersion: MASTERY_ALGORITHM_VERSION,
      calculatedAt,
      componentScores: {},
    };
  }

  const sumAvailableWeights = activeKeys.reduce(
    (acc, k) => acc + (weightsConfig[k] ?? 0),
    0
  );

  let finalMasteryScore = 0;
  const componentDetails: MasteryCalculationOutput["componentScores"] = {};

  for (const key of activeKeys) {
    const rawScore = aggregatedComponents[key]!;
    const configuredWeight = weightsConfig[key] ?? 0;
    const normalizedWeight = configuredWeight / sumAvailableWeights;

    finalMasteryScore += rawScore * normalizedWeight;

    componentDetails[key] = {
      rawScore: Number(rawScore.toFixed(2)),
      configuredWeight,
      normalizedWeight: Number(normalizedWeight.toFixed(4)),
    };
  }

  finalMasteryScore = Number(Math.min(100, Math.max(0, finalMasteryScore)).toFixed(2));
  const confidenceScore = calculateEvidenceConfidence(evidenceList, referenceDate, recencyConfig);
  const masteryState = getMasteryState(finalMasteryScore);

  return {
    competencyId,
    category,
    masteryScore: finalMasteryScore,
    masteryState,
    confidenceScore,
    evidenceCount: evidenceList.length,
    evidenceTypes: Array.from(new Set(evidenceList.map((e) => e.evidenceType))),
    calculationVersion: MASTERY_ALGORITHM_VERSION,
    calculatedAt,
    componentScores: componentDetails,
  };
}
