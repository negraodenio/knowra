import { randomUUID as uuidv4 } from "crypto";
import { learningStateService } from "./learning-state-service";
import { calculateMastery, MasteryCalculationOutput } from "../mastery";
import { evaluateLearningGap, LearningGap } from "../gap-analysis";
import { getCompetencyById } from "../curriculum";
import { competencyMapService } from "../competency-map";
import { EvidenceType, MasteryState } from "../types";

export interface MasterySnapshotEntity {
  id: string;
  userId: string;
  learningGoalId: string;
  competencyId: string;
  masteryScore: number;
  masteryState: MasteryState;
  confidenceScore: number;
  calculationVersion: string;
  evidenceSummary: {
    evidenceCount: number;
    evidenceTypes: EvidenceType[];
  };
  snapshotReason: string;
  createdAt: string;
}

export interface DetailedCompetencyLearningState {
  competencyId: string;
  baselineScore: number;
  masteryScore: number;
  masteryState: MasteryState;
  confidenceScore: number;
  evidenceCount: number;
  evidenceTypes: EvidenceType[];
  lastEvidenceAt: string;
  gap?: LearningGap;
}

/**
 * MasteryService (§19, §21, §44)
 * Orchestrates mastery calculation, historical snapshot appending, gap state updates,
 * and maintains strict baseline score immutability.
 */
export class MasteryService {
  // Persistence caches (mirroring database tables)
  private snapshots: MasterySnapshotEntity[] = [];
  private gaps: Map<string, LearningGap> = new Map(); // `${userId}:${goalId}:${competencyId}`

  /**
   * Recalculates mastery for a specific competency following new evidence (§21)
   */
  async recalculateCompetencyMastery(
    userId: string,
    goalId: string,
    competencyId: string,
    snapshotReason = "EVIDENCE_EVALUATED"
  ): Promise<{
    masteryOutput: MasteryCalculationOutput;
    gap: LearningGap | null;
    snapshot: MasterySnapshotEntity;
  }> {
    // 1. Verify user ownership
    const goal = await learningStateService.getGoal(userId, goalId);

    // 2. Fetch competency definition to determine category (§6, §37)
    const competency = getCompetencyById(competencyId);
    if (!competency) {
      throw new Error(`Competency '${competencyId}' not found.`);
    }

    // 3. Fetch all evidence for learner & goal
    const allEvidence = await learningStateService.getAllEvidence(userId, goalId);
    const competencyEvidence = allEvidence.filter(
      (e) => e.competencyId === competencyId
    );

    // 4. Calculate Mastery & Confidence deterministically (§5, §12)
    const masteryOutput = calculateMastery(competencyId, competency.category, competencyEvidence);

    // 5. Evaluate Gaps using Prerequisite DAG awareness (§22, §26)
    const graph = competencyMapService.getGraph(goal.domainId);
    const existingGapKey = `${userId}:${goalId}:${competencyId}`;
    const existingGap = this.gaps.get(existingGapKey);

    const gap = evaluateLearningGap({
      userId,
      learningGoalId: goalId,
      competencyId,
      category: competency.category,
      masteryOutput,
      evidenceList: competencyEvidence,
      prerequisiteGraph: graph,
      existingGap,
    });

    if (gap) {
      this.gaps.set(existingGapKey, gap);
    }

    const now = new Date().toISOString();

    // 6. Update current competency state (PRESERVING BASELINE_SCORE §4, §54)
    await learningStateService.updateCompetencyMastery(
      userId,
      goalId,
      competencyId,
      masteryOutput.masteryScore,
      masteryOutput.masteryState,
      masteryOutput.confidenceScore
    );
    // Let's create an immutable snapshot (§19, §55)
    const snapshot: MasterySnapshotEntity = {
      id: uuidv4(),
      userId,
      learningGoalId: goalId,
      competencyId,
      masteryScore: masteryOutput.masteryScore,
      masteryState: masteryOutput.masteryState,
      confidenceScore: masteryOutput.confidenceScore,
      calculationVersion: masteryOutput.calculationVersion,
      evidenceSummary: {
        evidenceCount: masteryOutput.evidenceCount,
        evidenceTypes: masteryOutput.evidenceTypes,
      },
      snapshotReason,
      createdAt: now,
    };
    this.snapshots.push(snapshot);

    return { masteryOutput, gap, snapshot };
  }

  /**
   * Recalculates mastery across all competencies in a learning goal
   */
  async recalculateGoalMastery(
    userId: string,
    goalId: string
  ): Promise<DetailedCompetencyLearningState[]> {
    const goal = await learningStateService.getGoal(userId, goalId);
    const graph = competencyMapService.getGraph(goal.domainId);
    if (!graph) {
      throw new Error(`Domain graph not found for domain ${goal.domainId}`);
    }

    const competencyIds = graph.getAllCompetencyIds();
    const results: DetailedCompetencyLearningState[] = [];

    for (const compId of competencyIds) {
      const comp = getCompetencyById(compId);
      if (!comp) continue;

      const { masteryOutput, gap } = await this.recalculateCompetencyMastery(
        userId,
        goalId,
        compId,
        "BATCH_GOAL_RECALCULATION"
      );

      const baselineInfo = await learningStateService.getCompetencyBaseline(userId, goalId, compId);
      const baselineScore = baselineInfo ? baselineInfo.baselineScore : masteryOutput.masteryScore;

      results.push({
        competencyId: compId,
        baselineScore,
        masteryScore: masteryOutput.masteryScore,
        masteryState: masteryOutput.masteryState,
        confidenceScore: masteryOutput.confidenceScore,
        evidenceCount: masteryOutput.evidenceCount,
        evidenceTypes: masteryOutput.evidenceTypes,
        lastEvidenceAt: masteryOutput.calculatedAt,
        gap: gap || undefined,
      });
    }

    return results;
  }

  /**
   * Retrieves all historical snapshots for a competency (§19, §55)
   */
  async getSnapshots(
    userId: string,
    goalId: string,
    competencyId?: string
  ): Promise<MasterySnapshotEntity[]> {
    // Validate ownership
    await learningStateService.getGoal(userId, goalId);

    return this.snapshots.filter(
      (s) =>
        s.userId === userId &&
        s.learningGoalId === goalId &&
        (!competencyId || s.competencyId === competencyId)
    );
  }

  /**
   * Retrieves all gaps for a learner goal (§24, §46)
   */
  async getGaps(userId: string, goalId: string): Promise<LearningGap[]> {
    // Validate ownership
    await learningStateService.getGoal(userId, goalId);

    const userGaps: LearningGap[] = [];
    for (const [key, gap] of this.gaps.entries()) {
      if (key.startsWith(`${userId}:${goalId}:`)) {
        userGaps.push(gap);
      }
    }
    return userGaps;
  }
}

export const masteryService = new MasteryService();
