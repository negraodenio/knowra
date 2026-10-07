import { describe, it, expect } from "vitest";
import { Competency } from "@/lib/learning/types";
import {
  evaluateActionForCompetency,
  LearnerCompetencyState,
  DEFAULT_ESTIMATED_MINUTES,
} from "@/lib/learning/recommendations";
import { calculateNextBestAction } from "@/lib/learning/next-best-action";
import { LearningGap } from "@/lib/learning/gap-analysis";
import { PrerequisiteGraph } from "@/lib/learning/prerequisite-graph";
import { PYTHON_COMPETENCIES } from "@/lib/learning/curriculum/python";
import { MATHEMATICS_COMPETENCIES } from "@/lib/learning/curriculum/mathematics";
import { EXCEL_COMPETENCIES } from "@/lib/learning/curriculum/excel";

describe("Next Best Action Engine (§4, §5–12, §35–42, §60, §62, §66, §67)", () => {
  const dummyCompConceptual: Competency = {
    id: "comp-concept",
    domainId: "test-domain",
    title: "Theoretical Functions",
    description: "Concepts of functions",
    category: "CONCEPTUAL",
    prerequisites: [],
    difficulty: 2,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  const dummyCompProcedural: Competency = {
    id: "comp-proc",
    domainId: "test-domain",
    title: "Excel Data Lookup",
    description: "Lookup formulas",
    category: "PROCEDURAL",
    prerequisites: [],
    difficulty: 2,
    version: 1,
    status: "ACTIVE",
    provenance: "CURATED",
  };

  describe("MANDATORY ACTION DECISION TESTS (§60)", () => {
    it("LOW MASTERY + OPEN HIGH GAP -> REMEDIATE (§6, §38, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 35,
        confidenceScore: 0.85,
        evidenceCount: 3,
      };

      const gap: LearningGap = {
        id: "gap-1",
        userId: "u1",
        learningGoalId: "g1",
        competencyId: dummyCompConceptual.id,
        severity: "HIGH",
        masteryScore: 35,
        confidenceScore: 0.85,
        signals: [
          { type: "EXERCISE_FAILURE", description: "Failed test", observedScore: 30 },
          { type: "PERSISTENT_LOW_MASTERY", description: "Low mastery", observedScore: 35 },
        ],
        reason: "Two failure signals",
        status: "OPEN",
        detectedAt: new Date().toISOString(),
        version: 1,
      };

      const result = evaluateActionForCompetency(dummyCompConceptual, state, gap, 2);
      expect(result.action).toBe("REMEDIATE");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.REMEDIATE);
      expect(result.reason).toContain("open HIGH gap");
      expect(result.reason).toContain("blocks 2 downstream");
    });

    it("RECENT FAILURE WITHOUT CONFIRMED GAP -> RETRY (§7, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompProcedural.id,
        masteryScore: 45,
        confidenceScore: 0.4,
        evidenceCount: 1, // Single failure, not enough for gap
        lastEvidenceResult: "FAILURE",
        lastEvidenceScore: 40,
      };

      const result = evaluateActionForCompetency(dummyCompProcedural, state, undefined, 0);
      expect(result.action).toBe("RETRY");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.RETRY);
      expect(result.reason).toContain("immediate retry will clarify your state");
    });

    it("REVIEW DUE -> REVIEW (§8, §60)", () => {
      // 20 days ago evidence, mastery 78%
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const state: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 78,
        confidenceScore: 0.8,
        evidenceCount: 4,
        lastEvidenceAt: twentyDaysAgo,
      };

      const result = evaluateActionForCompetency(dummyCompConceptual, state, undefined, 0);
      expect(result.action).toBe("REVIEW");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.REVIEW);
      expect(result.reason).toContain("knowledge decay");
    });

    it("PROCEDURAL + DEVELOPING -> PRACTICE (§9, §40, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompProcedural.id,
        masteryScore: 68,
        confidenceScore: 0.75,
        evidenceCount: 3,
        lastEvidenceAt: new Date().toISOString(),
      };

      const result = evaluateActionForCompetency(dummyCompProcedural, state, undefined, 0);
      expect(result.action).toBe("PRACTICE");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.PRACTICE);
      expect(result.reason).toContain("procedural competency with developing mastery");
    });

    it("CONCEPTUAL + DEVELOPING -> FEYNMAN (§10, §41, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 68,
        confidenceScore: 0.60,
        evidenceCount: 3,
        lastEvidenceAt: new Date().toISOString(),
      };

      const result = evaluateActionForCompetency(dummyCompConceptual, state, undefined, 0);
      expect(result.action).toBe("FEYNMAN");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.FEYNMAN);
      expect(result.reason).toContain("Feynman technique");
    });

    it("LOW MASTERY WITHOUT OTHER SIGNAL -> LEARN (§11, §42, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 0,
        confidenceScore: 0,
        evidenceCount: 0,
      };

      const result = evaluateActionForCompetency(dummyCompConceptual, state, undefined, 0);
      expect(result.action).toBe("LEARN");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.LEARN);
      expect(result.reason).toContain("New foundational instruction is recommended");
    });

    it("HIGH MASTERY + HIGH CONFIDENCE + NO BLOCKERS -> ADVANCE (§12, §37, §60)", () => {
      const state: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 92,
        confidenceScore: 0.90,
        evidenceCount: 5,
        lastEvidenceAt: new Date().toISOString(),
      };

      const result = evaluateActionForCompetency(dummyCompConceptual, state, undefined, 0);
      expect(result.action).toBe("ADVANCE");
      expect(result.estimatedMinutes).toBe(DEFAULT_ESTIMATED_MINUTES.ADVANCE);
      expect(result.reason).toContain("Ready to advance");
    });
  });

  describe("CONFLICTING SIGNALS TESTS (§36, §62)", () => {
    it("mastery = 80, confidence = 35 does NOT automatically ADVANCE (§36, §62)", () => {
      const stateProcedural: LearnerCompetencyState = {
        competencyId: dummyCompProcedural.id,
        masteryScore: 80,
        confidenceScore: 0.35, // Low confidence!
        evidenceCount: 2,
        lastEvidenceAt: new Date().toISOString(),
      };

      const resultProc = evaluateActionForCompetency(dummyCompProcedural, stateProcedural, undefined, 0);
      // High score with weak confidence requires PRACTICE to build confidence, not ADVANCE
      expect(resultProc.action).toBe("PRACTICE");
      expect(resultProc.action).not.toBe("ADVANCE");
      expect(resultProc.reason).toContain("evidence confidence is limited (35%)");

      const stateConceptual: LearnerCompetencyState = {
        competencyId: dummyCompConceptual.id,
        masteryScore: 80,
        confidenceScore: 0.35, // Low confidence!
        evidenceCount: 2,
        lastEvidenceAt: new Date().toISOString(),
      };

      const resultConc = evaluateActionForCompetency(dummyCompConceptual, stateConceptual, undefined, 0);
      // Conceptual with weak confidence requires FEYNMAN validation
      expect(resultConc.action).toBe("FEYNMAN");
      expect(resultConc.action).not.toBe("ADVANCE");
    });
  });

  describe("DETERMINISM & DOMAIN AGNOSTICISM (§66, §67)", () => {
    it("produces identical recommendations across multiple invocations given identical input (§66)", () => {
      const graph = new PrerequisiteGraph(PYTHON_COMPETENCIES);
      const states = new Map<string, LearnerCompetencyState>();
      states.set("py-variables-types", {
        competencyId: "py-variables-types",
        masteryScore: 40,
        confidenceScore: 0.5,
        evidenceCount: 1,
      });

      const context = {
        userId: "user-123",
        learningGoalId: "goal-123",
        objective: { domainId: "python-junior", targetOutcome: "Become junior Python developer" },
        competencyStates: states,
        gaps: new Map<string, LearningGap>(),
        prerequisiteGraph: graph,
        allCompetencies: PYTHON_COMPETENCIES,
        referenceDate: new Date("2026-10-07T12:00:00Z"),
      };

      const run1 = calculateNextBestAction(context);
      const run2 = calculateNextBestAction(context);
      const run3 = calculateNextBestAction(context);

      expect(run1.recommendation.competencyId).toBe(run2.recommendation.competencyId);
      expect(run1.recommendation.action).toBe(run2.recommendation.action);
      expect(run1.recommendation.priority).toBe(run2.recommendation.priority);
      expect(run1.recommendation.reason).toBe(run3.recommendation.reason);
    });

    it("operates identically across Python, Mathematics, and Excel without domain-specific branching (§67)", () => {
      const pyGraph = new PrerequisiteGraph(PYTHON_COMPETENCIES);
      const mathGraph = new PrerequisiteGraph(MATHEMATICS_COMPETENCIES);
      const excelGraph = new PrerequisiteGraph(EXCEL_COMPETENCIES);

      const makeContext = (domainId: string, graph: PrerequisiteGraph, comps: Competency[]) => ({
        userId: "test-user",
        learningGoalId: "test-goal",
        objective: { domainId },
        competencyStates: new Map<string, LearnerCompetencyState>(),
        gaps: new Map<string, LearningGap>(),
        prerequisiteGraph: graph,
        allCompetencies: comps,
      });

      const pyDecision = calculateNextBestAction(makeContext("python-junior", pyGraph, PYTHON_COMPETENCIES));
      const mathDecision = calculateNextBestAction(makeContext("math-exams", mathGraph, MATHEMATICS_COMPETENCIES));
      const excelDecision = calculateNextBestAction(makeContext("excel-pro", excelGraph, EXCEL_COMPETENCIES));

      // With zero mastery, initial unblocked competencies in all 3 domains get LEARN action
      expect(pyDecision.recommendation.action).toBe("LEARN");
      expect(mathDecision.recommendation.action).toBe("LEARN");
      expect(excelDecision.recommendation.action).toBe("LEARN");
    });
  });
});
