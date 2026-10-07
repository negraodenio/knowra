import { Competency } from "./types";
import {
  CandidateRecommendation,
  DEFAULT_ESTIMATED_MINUTES,
  DEFAULT_RECOMMENDATION_WEIGHTS,
  evaluateActionForCompetency,
  calculatePriorityScore,
  RECOMMENDATION_ALGORITHM_VERSION,
  RecommendationContext,
} from "./recommendations";
import { DEFAULT_PREREQUISITE_BLOCK_CONFIG } from "./prerequisite-graph";
import { getCuratedCompetenciesByDomain } from "./curriculum";

export interface NextBestActionDecision {
  recommendation: CandidateRecommendation;
  allCandidates: CandidateRecommendation[];
  isTerminalAdvancement: boolean;
}

/**
 * Pure Deterministic Next Best Action Engine (§18, §19, §33, §34, §59)
 * Evaluates the full learner state across the curriculum DAG:
 * 1. Identifies unblocked competencies and active open gaps.
 * 2. Prerequisite blockers strictly prevent premature downstream actions.
 * 3. Evaluates deterministic priority for every valid candidate.
 * 4. Selects the top-priority Next Best Action.
 * 5. Returns terminal ADVANCE if all competencies satisfy the goal thresholds.
 */
export function calculateNextBestAction(
  context: RecommendationContext
): NextBestActionDecision {
  const {
    objective,
    competencyStates,
    gaps,
    prerequisiteGraph,
    weightsConfig = DEFAULT_RECOMMENDATION_WEIGHTS,
    prereqThresholds = DEFAULT_PREREQUISITE_BLOCK_CONFIG,
    referenceDate = new Date(),
  } = context;

  const competencies: Competency[] =
    context.allCompetencies ||
    getCuratedCompetenciesByDomain(objective.domainId) ||
    [];

  // Convert states to simple map for prerequisite checker
  const statesSummary = new Map<string, { masteryScore: number; confidenceScore: number }>();
  for (const [id, s] of competencyStates.entries()) {
    statesSummary.set(id, {
      masteryScore: s.masteryScore,
      confidenceScore: s.confidenceScore,
    });
  }

  // 1. Gather Candidate Competencies
  // A candidate is either:
  // (a) An unblocked competency needing learning, practice, review, or advancement
  // (b) A competency with an active OPEN gap that needs remediation
  const candidateList: CandidateRecommendation[] = [];

  let allCompleted = true;

  for (const comp of competencies) {
    const state = competencyStates.get(comp.id);
    const gap = gaps.get(comp.id);
    const mastery = state?.masteryScore ?? 0;
    const confidence = state?.confidenceScore ?? 0;
    const hasOpenGap = gap && gap.status === "OPEN";

    const isMastered =
      mastery >= prereqThresholds.minimumMastery &&
      confidence >= prereqThresholds.minimumConfidence &&
      !hasOpenGap;

    if (!isMastered) {
      allCompleted = false;
    }

    // Check if blocked by upstream prerequisites
    const isBlocked = prerequisiteGraph.isBlockedByPrerequisite(
      comp.id,
      statesSummary,
      gaps,
      prereqThresholds
    );

    // If blocked and does NOT have an open gap, it cannot be acted upon yet
    if (isBlocked && !hasOpenGap) {
      continue;
    }

    // Downstream impact: number of direct and transitive dependents
    const downstreamDependents = prerequisiteGraph.getAllDependents(comp.id);
    const downstreamCount = downstreamDependents.length;

    // Evaluate appropriate action deterministically
    const actionEval = evaluateActionForCompetency(
      comp,
      state,
      gap,
      downstreamCount,
      referenceDate,
      prereqThresholds
    );

    // Calculate deterministic priority score (0–100)
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

    candidateList.push({
      competencyId: comp.id,
      competencyTitle: comp.title,
      category: comp.category,
      action: actionEval.action,
      priority: priorityResult.priority,
      reason: actionEval.reason,
      estimatedMinutes: actionEval.estimatedMinutes,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      breakdown: priorityResult.breakdown,
    });
  }

  // 2. Sort Candidates deterministically:
  // Primary: Priority descending
  // Secondary: Downstream impact descending
  // Tertiary: Competency ID ascending
  candidateList.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    if (b.breakdown.prereqComponent !== a.breakdown.prereqComponent) {
      return b.breakdown.prereqComponent - a.breakdown.prereqComponent;
    }
    return a.competencyId.localeCompare(b.competencyId);
  });

  // 3. Terminal Advancement Case (§34)
  // If all competencies in the curriculum meet mastery and confidence targets,
  // return terminal ADVANCE on the terminal curriculum node.
  if (allCompleted || candidateList.length === 0) {
    const lastComp = competencies[competencies.length - 1] || {
      id: "curriculum-complete",
      title: "Goal Milestones",
      category: "CONCEPTUAL" as const,
    };

    const terminalRec: CandidateRecommendation = {
      competencyId: lastComp.id,
      competencyTitle: lastComp.title,
      category: lastComp.category,
      action: "ADVANCE",
      priority: 100.0,
      reason: "All competencies satisfy target mastery and confidence thresholds. You are ready to advance to your next learning goal.",
      estimatedMinutes: DEFAULT_ESTIMATED_MINUTES.ADVANCE,
      algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
      breakdown: {
        gapComponent: 0,
        prereqComponent: 0,
        deficitComponent: 0,
        objectiveComponent: 0,
        recencyComponent: 0,
        deadlineComponent: 0,
      },
    };

    return {
      recommendation: terminalRec,
      allCandidates: [terminalRec],
      isTerminalAdvancement: true,
    };
  }

  // Top candidate is the Next Best Action
  return {
    recommendation: candidateList[0],
    allCandidates: candidateList,
    isTerminalAdvancement: false,
  };
}
