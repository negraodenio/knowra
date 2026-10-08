import { AssessmentBlueprint } from "../types";

export const CURATED_ASSESSMENT_BLUEPRINTS: AssessmentBlueprint[] = [
  // ------------------------------------------------------------
  // Python Junior Developer
  // ------------------------------------------------------------
  {
    id: "bp-python-final-v1",
    domainId: "python-junior",
    competencyMapVersion: "1.0.0",
    assessmentType: "FINAL",
    targetCompetencies: [
      "py-variables-types",
      "py-conditionals",
      "py-loops-iteration",
      "py-functions-scope",
      "py-data-structures-lists-tuples",
    ],
    difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
    itemCount: 5,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-python-d7-v1",
    domainId: "python-junior",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D7",
    targetCompetencies: [
      "py-variables-types",
      "py-conditionals",
      "py-loops-iteration",
      "py-functions-scope",
    ],
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    itemCount: 4,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-python-d30-v1",
    domainId: "python-junior",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D30",
    targetCompetencies: [
      "py-variables-types",
      "py-conditionals",
      "py-loops-iteration",
      "py-functions-scope",
    ],
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    itemCount: 4,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },

  // ------------------------------------------------------------
  // Mathematics Curriculum
  // ------------------------------------------------------------
  {
    id: "bp-math-final-v1",
    domainId: "math-exams",
    competencyMapVersion: "1.0.0",
    assessmentType: "FINAL",
    targetCompetencies: [
      "math-algebraic-expressions",
      "math-linear-equations",
      "math-linear-systems",
      "math-quadratic-equations",
    ],
    difficultyDistribution: { easy: 20, medium: 60, hard: 20 },
    itemCount: 4,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-math-d7-v1",
    domainId: "math-exams",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D7",
    targetCompetencies: [
      "math-algebraic-expressions",
      "math-linear-equations",
    ],
    difficultyDistribution: { easy: 50, medium: 50, hard: 0 },
    itemCount: 2,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-math-d30-v1",
    domainId: "math-exams",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D30",
    targetCompetencies: [
      "math-algebraic-expressions",
      "math-linear-equations",
    ],
    difficultyDistribution: { easy: 50, medium: 50, hard: 0 },
    itemCount: 2,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },

  // ------------------------------------------------------------
  // Excel Professional
  // ------------------------------------------------------------
  {
    id: "bp-excel-final-v1",
    domainId: "excel-pro",
    competencyMapVersion: "1.0.0",
    assessmentType: "FINAL",
    targetCompetencies: [
      "xl-navigation-basics",
      "xl-core-math-functions",
      "xl-logical-formulas",
      "xl-conditional-math",
    ],
    difficultyDistribution: { easy: 25, medium: 50, hard: 25 },
    itemCount: 4,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-excel-d7-v1",
    domainId: "excel-pro",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D7",
    targetCompetencies: [
      "xl-navigation-basics",
      "xl-core-math-functions",
    ],
    difficultyDistribution: { easy: 50, medium: 50, hard: 0 },
    itemCount: 2,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
  {
    id: "bp-excel-d30-v1",
    domainId: "excel-pro",
    competencyMapVersion: "1.0.0",
    assessmentType: "RETENTION_D30",
    targetCompetencies: [
      "xl-core-math-functions",
      "xl-logical-formulas",
    ],
    difficultyDistribution: { easy: 50, medium: 50, hard: 0 },
    itemCount: 2,
    passingThreshold: 70.0,
    independenceRequirements: { disallowBaselineItemIds: true, maxSemanticSimilarity: 0.6 },
    version: "v1",
    status: "ACTIVE",
    createdAt: "2026-10-07T00:00:00Z",
  },
];

export function getBlueprintsByDomainAndType(
  domainId: string,
  assessmentType: string
): AssessmentBlueprint | undefined {
  return CURATED_ASSESSMENT_BLUEPRINTS.find(
    (bp) => bp.domainId === domainId && bp.assessmentType === assessmentType && bp.status === "ACTIVE"
  );
}

export function getBlueprintById(id: string): AssessmentBlueprint | undefined {
  return CURATED_ASSESSMENT_BLUEPRINTS.find((bp) => bp.id === id);
}
