import { Competency, CompetencyCategory, NextBestAction } from "./types";
import {
  evaluateActionForCompetency,
  calculatePriorityScore,
  RECOMMENDATION_ALGORITHM_VERSION,
  RecommendationContext,
  DEFAULT_RECOMMENDATION_WEIGHTS,
} from "./recommendations";
import { DEFAULT_PREREQUISITE_BLOCK_CONFIG } from "./prerequisite-graph";
import { getCuratedCompetenciesByDomain } from "./curriculum";

export interface PlanStep {
  stepNumber: number;
  competencyId: string;
  competencyTitle: string;
  category: CompetencyCategory;
  action: NextBestAction;
  priority: number;
  reason: string;
  estimatedMinutes: number;
  status: "ACTIVE" | "UPCOMING" | "COMPLETED";
}

export interface AdaptiveLearningPlan {
  goalId: string;
  domainId: string;
  targetOutcome: string;
  generatedAt: string;
  algorithmVersion: string;
  totalEstimatedMinutes: number;
  completedStepsCount: number;
  activeStep?: PlanStep;
  steps: PlanStep[];
}

/**
 * Pure Deterministic Adaptive Learning Plan Generator (§24, §25, §26, §55)
 * Derives an adaptive projection dynamically on the fly from current state,
 * prerequisite DAG ordering, and open gaps.
 * Does NOT persist a static rigid schedule, guaranteeing plans never become stale.
 */
export function generateAdaptiveLearningPlan(
  context: RecommendationContext
): AdaptiveLearningPlan {
  const {
    learningGoalId,
    objective,
    competencyStates,
    gaps,
    prerequisiteGraph,
    weightsConfig = DEFAULT_RECOMMENDATION_WEIGHTS,
    prereqThresholds = DEFAULT_PREREQUISITE_BLOCK_CONFIG,
    referenceDate = new Date(),
  } = context;

  const domainCompetencies: Competency[] =
    context.allCompetencies ||
    getCuratedCompetenciesByDomain(objective.domainId) ||
    [];

  // Topological ordering of competencies according to prerequisite DAG (§18, §26)
  let topoOrder: string[];
  try {
    topoOrder = prerequisiteGraph.getTopologicalOrder();
  } catch {
    topoOrder = domainCompetencies.map((c) => c.id);
  }

  const statesSummary = new Map<string, { masteryScore: number; confidenceScore: number }>();
  for (const [id, s] of competencyStates.entries()) {
    statesSummary.set(id, {
      masteryScore: s.masteryScore,
      confidenceScore: s.confidenceScore,
    });
  }

  const completedSteps: PlanStep[] = [];
  const activeAndUpcomingSteps: PlanStep[] = [];

  for (const compId of topoOrder) {
    const comp = domainCompetencies.find((c) => c.id === compId);
    if (!comp) continue;

    const state = competencyStates.get(compId);
    const gap = gaps.get(compId);
    const mastery = state?.masteryScore ?? 0;
    const confidence = state?.confidenceScore ?? 0;
    const hasOpenGap = gap && gap.status === "OPEN";

    const isMastered =
      mastery >= prereqThresholds.minimumMastery &&
      confidence >= prereqThresholds.minimumConfidence &&
      !hasOpenGap;

    const downstreamDependents = prerequisiteGraph.getAllDependents(compId);
    const downstreamCount = downstreamDependents.length;

    const actionEval = evaluateActionForCompetency(
      comp,
      state,
      gap,
      downstreamCount,
      referenceDate,
      prereqThresholds
    );

    const priorityResult = calculatePriorityScore(
      comp,
      actionEval.action,
      state,
      gap,
      downstreamCount,
      objective,
      weightsConfig,
      referenceDate
    );

    if (isMastered) {
      completedSteps.push({
        stepNumber: 0,
        competencyId: comp.id,
        competencyTitle: comp.title,
        category: comp.category,
        action: "ADVANCE",
        priority: 100,
        reason: `${comp.title} has reached required mastery (${mastery.toFixed(0)}%) and confidence (${(confidence * 100).toFixed(0)}%).`,
        estimatedMinutes: 0,
        status: "COMPLETED",
      });
    } else {
      activeAndUpcomingSteps.push({
        stepNumber: 0,
        competencyId: comp.id,
        competencyTitle: comp.title,
        category: comp.category,
        action: actionEval.action,
        priority: priorityResult.priority,
        reason: actionEval.reason,
        estimatedMinutes: actionEval.estimatedMinutes,
        status: "UPCOMING",
      });
    }
  }

  // Sort upcoming steps:
  // Primary: Unblocked nodes first (highest priority)
  // Secondary: Priority score descending
  activeAndUpcomingSteps.sort((a, b) => {
    const aBlocked = prerequisiteGraph.isBlockedByPrerequisite(
      a.competencyId,
      statesSummary,
      gaps,
      prereqThresholds
    );
    const bBlocked = prerequisiteGraph.isBlockedByPrerequisite(
      b.competencyId,
      statesSummary,
      gaps,
      prereqThresholds
    );

    // Unblocked steps take precedence over blocked steps
    if (!aBlocked && bBlocked) return -1;
    if (aBlocked && !bBlocked) return 1;

    // Both unblocked or both blocked: sort by priority descending
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.competencyId.localeCompare(b.competencyId);
  });

  // Assign sequential step numbers
  let stepIndex = 1;
  const orderedSteps: PlanStep[] = [];

  // Completed steps first
  for (const step of completedSteps) {
    orderedSteps.push({
      ...step,
      stepNumber: stepIndex++,
    });
  }

  // Active step (the first uncompleted step)
  if (activeAndUpcomingSteps.length > 0) {
    const firstUpcoming = activeAndUpcomingSteps[0];
    orderedSteps.push({
      ...firstUpcoming,
      stepNumber: stepIndex++,
      status: "ACTIVE",
    });

    // Remaining upcoming steps
    for (let i = 1; i < activeAndUpcomingSteps.length; i++) {
      orderedSteps.push({
        ...activeAndUpcomingSteps[i],
        stepNumber: stepIndex++,
        status: "UPCOMING",
      });
    }
  }

  const activeStep = orderedSteps.find((s) => s.status === "ACTIVE");
  const totalEstimatedMinutes = activeAndUpcomingSteps.reduce(
    (sum, s) => sum + s.estimatedMinutes,
    0
  );

  return {
    goalId: learningGoalId,
    domainId: objective.domainId,
    targetOutcome: objective.targetOutcome || "Mastery of Domain Curriculum",
    generatedAt: referenceDate.toISOString(),
    algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    totalEstimatedMinutes,
    completedStepsCount: completedSteps.length,
    activeStep,
    steps: orderedSteps,
  };
}
