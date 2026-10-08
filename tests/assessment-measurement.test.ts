import { describe, it, expect, beforeEach, vi } from "vitest";
import { assessmentService } from "@/lib/learning/assessment/assessment-service";
import {
  evaluateAssessmentItem,
  scoreAssessmentSession,
} from "@/lib/learning/assessment/assessment-engine";
import {
  calculateLearningGain,
  calculateRetention,
} from "@/lib/learning/assessment/measurement-engine";
import {
  validateItemIndependence,
  CURATED_INDEPENDENT_ASSESSMENT_ITEMS,
  getIndependentAssessmentItems,
} from "@/lib/learning/assessment/curriculum/items";
import {
  CURATED_ASSESSMENT_BLUEPRINTS,
  getBlueprintsByDomainAndType,
} from "@/lib/learning/assessment/curriculum/blueprints";
import { generateIndependentAssessmentItemWithAI } from "@/lib/ai/assessment";
import { aiGateway } from "@/lib/ai/gateway";
import { learningStateService } from "@/lib/learning/state/learning-state-service";
import { AssessmentItem, AssessmentResponse } from "@/lib/learning/assessment/types";

describe("Sprint 7 — Assessment & Measurement Engine (§1–§18)", () => {
  const userA = "11111111-1111-4111-a111-111111111111";
  const userB = "22222222-2222-4222-b222-222222222222";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------
  // A. BLUEPRINTS (§1)
  // ------------------------------------------------------------
  describe("Assessment Blueprints (§1)", () => {
    it("provides versioned blueprints across Python, Mathematics, and Excel", () => {
      const pyFinal = getBlueprintsByDomainAndType("python-junior", "FINAL");
      const pyD7 = getBlueprintsByDomainAndType("python-junior", "RETENTION_D7");
      const pyD30 = getBlueprintsByDomainAndType("python-junior", "RETENTION_D30");

      expect(pyFinal).toBeDefined();
      expect(pyFinal?.targetCompetencies.length).toBeGreaterThan(0);
      expect(pyFinal?.passingThreshold).toBe(70.0);
      expect(pyD7).toBeDefined();
      expect(pyD30).toBeDefined();

      const mathFinal = getBlueprintsByDomainAndType("math-exams", "FINAL");
      const excelFinal = getBlueprintsByDomainAndType("excel-pro", "FINAL");

      expect(mathFinal).toBeDefined();
      expect(excelFinal).toBeDefined();
    });

    it("enforces independence requirements in blueprint metadata", () => {
      for (const bp of CURATED_ASSESSMENT_BLUEPRINTS) {
        expect(bp.independenceRequirements.disallowBaselineItemIds).toBe(true);
        expect(bp.status).toBe("ACTIVE");
      }
    });
  });

  // ------------------------------------------------------------
  // B. ITEM INDEPENDENCE & ANTI-LEAKAGE (§2, §3, §13)
  // ------------------------------------------------------------
  describe("Item Independence & Anti-Leakage Safeguards (§3, §13)", () => {
    const diagnosticItemIds = [
      "diag-py-var-1",
      "diag-py-cond-1",
      "diag-py-loop-1",
      "diag-py-func-1",
      "diag-py-ds-1",
    ];

    it("verifies that final assessment items do NOT reuse baseline item IDs", () => {
      const finalItems = getIndependentAssessmentItems("python-junior", "FINAL");
      const check = validateItemIndependence(diagnosticItemIds, finalItems);

      expect(check.isIndependent).toBe(true);
      expect(check.violations.length).toBe(0);
    });

    it("verifies that D7 and D30 items do NOT reuse baseline item IDs", () => {
      const d7Items = getIndependentAssessmentItems("python-junior", "RETENTION_D7");
      const d30Items = getIndependentAssessmentItems("python-junior", "RETENTION_D30");

      const checkD7 = validateItemIndependence(diagnosticItemIds, d7Items);
      const checkD30 = validateItemIndependence(diagnosticItemIds, d30Items);

      expect(checkD7.isIndependent).toBe(true);
      expect(checkD30.isIndependent).toBe(true);
    });

    it("detects and flags simulated item ID or prompt duplication", () => {
      const leakingItem: AssessmentItem = {
        id: "diag-py-var-1", // exact collision
        domainId: "python-junior",
        competencyId: "py-variables-types",
        assessmentVersion: "v1",
        itemVersion: 1,
        itemType: "MULTIPLE_CHOICE",
        difficulty: 1,
        prompt: "In Python, what is the data type of the expression `type(4.0 / 2)`?", // exact prompt duplication
        correctAnswer: "<class 'float'>",
        formType: "FINAL",
        provenance: "CURATED",
        status: "ACTIVE",
        metadata: {},
      };

      const check = validateItemIndependence(
        diagnosticItemIds,
        [leakingItem],
        ["In Python, what is the data type of the expression `type(4.0 / 2)`?"]
      );

      expect(check.isIndependent).toBe(false);
      expect(check.violations.length).toBe(2);
      expect(check.violations[0]).toContain("Item ID collision with baseline: diag-py-var-1");
      expect(check.violations[1]).toContain("Prompt text duplication detected");
    });
  });

  // ------------------------------------------------------------
  // C. DETERMINISTIC SCORING (§5)
  // ------------------------------------------------------------
  describe("Deterministic Item & Session Scoring (§5)", () => {
    it("evaluates multiple choice correctly (case-insensitive)", () => {
      const item: AssessmentItem = {
        id: "test-mc",
        domainId: "python-junior",
        competencyId: "py-variables-types",
        assessmentVersion: "v1",
        itemVersion: 1,
        itemType: "MULTIPLE_CHOICE",
        difficulty: 1,
        prompt: "Choose the correct type",
        options: ["True", "False"],
        correctAnswer: "True",
        formType: "FINAL",
        provenance: "CURATED",
        status: "ACTIVE",
        metadata: {},
      };

      expect(evaluateAssessmentItem(item, "True").isCorrect).toBe(true);
      expect(evaluateAssessmentItem(item, "true").score).toBe(100);
      expect(evaluateAssessmentItem(item, "False").isCorrect).toBe(false);
      expect(evaluateAssessmentItem(item, "False").score).toBe(0);
    });

    it("evaluates numeric answers with float tolerance", () => {
      const item: AssessmentItem = {
        id: "test-num",
        domainId: "math-exams",
        competencyId: "math-linear-equations",
        assessmentVersion: "v1",
        itemVersion: 1,
        itemType: "NUMERIC",
        difficulty: 1,
        prompt: "Calculate 15 / 2",
        correctAnswer: "7.5",
        formType: "FINAL",
        provenance: "CURATED",
        status: "ACTIVE",
        metadata: {},
      };

      expect(evaluateAssessmentItem(item, "7.5").isCorrect).toBe(true);
      expect(evaluateAssessmentItem(item, "7,5").isCorrect).toBe(true);
      expect(evaluateAssessmentItem(item, "7.500").score).toBe(100);
      expect(evaluateAssessmentItem(item, "8").score).toBe(0);
    });

    it("evaluates true/false answers normalized", () => {
      const item: AssessmentItem = {
        id: "test-tf",
        domainId: "python-junior",
        competencyId: "py-conditionals",
        assessmentVersion: "v1",
        itemVersion: 1,
        itemType: "TRUE_FALSE",
        difficulty: 1,
        prompt: "Is 2 > 1?",
        correctAnswer: "True",
        formType: "FINAL",
        provenance: "CURATED",
        status: "ACTIVE",
        metadata: {},
      };

      expect(evaluateAssessmentItem(item, "true").isCorrect).toBe(true);
      expect(evaluateAssessmentItem(item, "t").score).toBe(100);
      expect(evaluateAssessmentItem(item, "false").score).toBe(0);
    });

    it("aggregates session responses into normalized 0-100 overall and competency scores", () => {
      const mockItems: AssessmentItem[] = [
        {
          id: "it-1",
          domainId: "python-junior",
          competencyId: "py-variables",
          assessmentVersion: "v1",
          itemVersion: 1,
          itemType: "MULTIPLE_CHOICE",
          difficulty: 1,
          prompt: "P1",
          correctAnswer: "A",
          formType: "FINAL",
          provenance: "CURATED",
          status: "ACTIVE",
          metadata: {},
        },
        {
          id: "it-2",
          domainId: "python-junior",
          competencyId: "py-variables",
          assessmentVersion: "v1",
          itemVersion: 1,
          itemType: "MULTIPLE_CHOICE",
          difficulty: 1,
          prompt: "P2",
          correctAnswer: "B",
          formType: "FINAL",
          provenance: "CURATED",
          status: "ACTIVE",
          metadata: {},
        },
        {
          id: "it-3",
          domainId: "python-junior",
          competencyId: "py-loops",
          assessmentVersion: "v1",
          itemVersion: 1,
          itemType: "NUMERIC",
          difficulty: 2,
          prompt: "P3",
          correctAnswer: "10",
          formType: "FINAL",
          provenance: "CURATED",
          status: "ACTIVE",
          metadata: {},
        },
      ];

      const mockResponses: AssessmentResponse[] = [
        {
          id: "r-1",
          sessionId: "sess-1",
          userId: userA,
          itemId: "it-1",
          competencyId: "py-variables",
          answer: "A",
          isCorrect: true,
          score: 100,
          submittedAt: new Date().toISOString(),
        },
        {
          id: "r-2",
          sessionId: "sess-1",
          userId: userA,
          itemId: "it-2",
          competencyId: "py-variables",
          answer: "wrong",
          isCorrect: false,
          score: 0,
          submittedAt: new Date().toISOString(),
        },
        {
          id: "r-3",
          sessionId: "sess-1",
          userId: userA,
          itemId: "it-3",
          competencyId: "py-loops",
          answer: "10",
          isCorrect: true,
          score: 100,
          submittedAt: new Date().toISOString(),
        },
      ];

      const result = scoreAssessmentSession(mockItems, mockResponses);

      // (100 + 0 + 100) / 3 = 66.67
      expect(result.overallScore).toBe(66.67);
      expect(result.competencyScores["py-variables"].score).toBe(50.0);
      expect(result.competencyScores["py-loops"].score).toBe(100.0);
      expect(result.itemEvaluations.length).toBe(3);
    });
  });

  // ------------------------------------------------------------
  // D. LEARNING GAIN (§7)
  // ------------------------------------------------------------
  describe("Learning Gain Engine (§7)", () => {
    it("computes positive learning gain correctly (Final > Baseline)", () => {
      const report = calculateLearningGain({
        learningGoalId: "goal-1",
        userId: userA,
        domainId: "python-junior",
        baselineSessionId: "base-sess-1",
        baselineScore: 52.0,
        finalSessionId: "final-sess-1",
        finalScore: 78.0,
        baselineCompetencyScores: { "py-variables": 40.0, "py-loops": 60.0 },
        finalCompetencyScores: { "py-variables": 85.0, "py-loops": 70.0 },
      });

      // 78 - 52 = +26 points
      expect(report.learningGain).toBe(26.0);
      // Relative gain: 26 / (100 - 52) = 26 / 48 = 0.5417
      expect(report.relativeGain).toBe(0.5417);

      const pyVarGain = report.competencyGains.find((c) => c.competencyId === "py-variables");
      expect(pyVarGain?.gain).toBe(45.0);
      expect(pyVarGain?.status).toBe("LEARNED");

      const pyLoopGain = report.competencyGains.find((c) => c.competencyId === "py-loops");
      expect(pyLoopGain?.gain).toBe(10.0);
      expect(pyLoopGain?.status).toBe("LEARNED");
    });

    it("computes zero or negative learning gain (regression)", () => {
      const report = calculateLearningGain({
        learningGoalId: "goal-2",
        userId: userA,
        domainId: "python-junior",
        baselineSessionId: "base-sess-2",
        baselineScore: 70.0,
        finalSessionId: "final-sess-2",
        finalScore: 55.0,
        baselineCompetencyScores: { "py-variables": 80.0 },
        finalCompetencyScores: { "py-variables": 50.0 },
      });

      // 55 - 70 = -15 points
      expect(report.learningGain).toBe(-15.0);
      expect(report.relativeGain).toBeLessThan(0);

      const compGain = report.competencyGains[0];
      expect(compGain.gain).toBe(-30.0);
      expect(compGain.status).toBe("REGRESSED");
    });
  });

  // ------------------------------------------------------------
  // E. RETENTION (D7 & D30) (§8)
  // ------------------------------------------------------------
  describe("Knowledge & Skill Retention (§8)", () => {
    it("computes D7 retention metrics without division by zero", () => {
      const d7Report = calculateRetention({
        learningGoalId: "goal-1",
        userId: userA,
        domainId: "python-junior",
        retentionType: "D7",
        baselineScore: 50.0,
        finalSessionId: "final-sess-1",
        finalScore: 80.0,
        retentionSessionId: "ret-sess-d7",
        retentionScore: 72.0,
        daysSinceFinal: 7,
        finalCompetencyScores: { "py-variables": 80.0 },
        retentionCompetencyScores: { "py-variables": 75.0 },
      });

      // 72 / 80 = 0.9000 (90% retention)
      expect(d7Report.retentionRatio).toBe(0.9);
      // Retained gain from baseline: 72 - 50 = +22 points
      expect(d7Report.gainRetained).toBe(22.0);
      expect(d7Report.daysSinceFinal).toBe(7);
      expect(d7Report.competencyRetention[0].ratio).toBe(0.9375); // 75/80
    });

    it("handles zero final score safely with guarded fallback", () => {
      const d7Zero = calculateRetention({
        learningGoalId: "goal-zero",
        userId: userA,
        domainId: "python-junior",
        retentionType: "D7",
        baselineScore: 0.0,
        finalSessionId: "final-sess-zero",
        finalScore: 0.0,
        retentionSessionId: "ret-sess-zero",
        retentionScore: 0.0,
        daysSinceFinal: 7,
      });

      expect(d7Zero.retentionRatio).toBe(1.0);
      expect(d7Zero.gainRetained).toBe(0.0);
    });
  });

  // ------------------------------------------------------------
  // F. BASELINE IMMUTABILITY & END-TO-END FLOW (§4, §6, §9)
  // ------------------------------------------------------------
  describe("End-to-End Flow & Baseline Immutability (§4, §6, §9)", () => {
    it("verifies that subsequent assessments never mutate historical baseline score", async () => {
      // 1. Establish Goal & Diagnostic Baseline
      const { goal } = await learningStateService.createGoal(userA, {
        rawObjective: "Learn Python programming",
        selectedDomainId: "python-junior",
      });

      const { session: diagSession, items: diagItems } =
        await learningStateService.startDiagnostic(userA, goal.id);

      // Answer diagnostic items
      for (const item of diagItems) {
        await learningStateService.submitDiagnosticAnswer(
          userA,
          diagSession.id,
          item.id,
          item.options ? item.options[0] : "10"
        );
      }

      const report = await learningStateService.completeDiagnostic(
        userA,
        diagSession.id
      );
      const originalBaselineScore = report.overallBaselineScore;

      // 2. Start Independent FINAL assessment
      const { session: finalSession, items: finalItems } =
        await assessmentService.startAssessmentSession({
          userId: userA,
          learningGoalId: goal.id,
          domainId: "python-junior",
          assessmentType: "FINAL",
          baselineItemIdsToAvoid: diagSession.itemIds,
        });

      // Verify items are independent
      for (const item of finalItems) {
        expect(diagSession.itemIds).not.toContain(item.id);
      }

      // Answer final items
      for (const item of finalItems) {
        const fullItem = CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((i) => i.id === item.id);
        await assessmentService.submitAnswer({
          userId: userA,
          sessionId: finalSession.id,
          itemId: item.id,
          answer: fullItem?.correctAnswer || "True",
        });
      }

      const finalResult = await assessmentService.completeAssessment(userA, finalSession.id);
      expect(finalResult.session.status).toBe("COMPLETED");
      expect(finalResult.learningGainReport).toBeDefined();

      // INVARIANT CHECK: Baseline score must be identical to original baseline!
      const currentBaselineAfterFinal = await learningStateService.getCurrentLearningState(userA, goal.id);
      expect(currentBaselineAfterFinal.overallBaselineScore).toBe(originalBaselineScore);

      // 3. Start RETENTION D7 assessment
      const { session: d7Session, items: d7Items } =
        await assessmentService.startAssessmentSession({
          userId: userA,
          learningGoalId: goal.id,
          domainId: "python-junior",
          assessmentType: "RETENTION_D7",
        });

      for (const item of d7Items) {
        const fullItem = CURATED_INDEPENDENT_ASSESSMENT_ITEMS.find((i) => i.id === item.id);
        await assessmentService.submitAnswer({
          userId: userA,
          sessionId: d7Session.id,
          itemId: item.id,
          answer: fullItem?.correctAnswer || "True",
        });
      }

      const d7Result = await assessmentService.completeAssessment(userA, d7Session.id);
      expect(d7Result.retentionReport).toBeDefined();

      // INVARIANT CHECK 2: Baseline score remains immutable after D7!
      const currentBaselineAfterD7 = await learningStateService.getCurrentLearningState(userA, goal.id);
      expect(currentBaselineAfterD7.overallBaselineScore).toBe(originalBaselineScore);

      // 4. Check Goal Measurement Dashboard API report
      const measurementReport = await assessmentService.getMeasurementReport(userA, goal.id);
      expect(measurementReport.baseline.score).toBe(originalBaselineScore);
      expect(measurementReport.final?.score).toBe(finalResult.scoreResult.overallScore);
      expect(measurementReport.retention.d7?.retentionScore).toBe(d7Result.scoreResult.overallScore);
    });
  });

  // ------------------------------------------------------------
  // G. SECURITY & CROSS-USER ISOLATION (§4, §16)
  // ------------------------------------------------------------
  describe("Security & Cross-User Isolation (§4, §16)", () => {
    it("prevents User B from accessing or answering User A's assessment session", async () => {
      const { goal } = await learningStateService.createGoal(userA, {
        rawObjective: "Learn Python variables",
        selectedDomainId: "python-junior",
      });

      const { session } = await assessmentService.startAssessmentSession({
        userId: userA,
        learningGoalId: goal.id,
        domainId: "python-junior",
        assessmentType: "FINAL",
      });

      // User B attempts to answer User A's session
      await expect(
        assessmentService.submitAnswer({
          userId: userB,
          sessionId: session.id,
          itemId: session.itemIds[0],
          answer: "Exploit",
        })
      ).rejects.toThrow(/unauthorized|access denied/i);

      // User B attempts to complete User A's session
      await expect(
        assessmentService.completeAssessment(userB, session.id)
      ).rejects.toThrow(/unauthorized|access denied/i);

      // User B attempts to view User A's measurement report
      await expect(
        assessmentService.getMeasurementReport(userB, goal.id)
      ).rejects.toThrow(/unauthorized|access denied/i);
    });
  });

  // ------------------------------------------------------------
  // H. AI ASSESSMENT ITEM GENERATION (§11, §12)
  // ------------------------------------------------------------
  describe("AI Assessment Item Generation (§11, §12)", () => {
    it("generates structured independent assessment item via AI Gateway", async () => {
      const spy = vi.spyOn(aiGateway, "generateStructured").mockResolvedValueOnce({
        data: {
          prompt: "What is the return type of float(42)?",
          itemType: "MULTIPLE_CHOICE",
          difficulty: 1,
          options: ["float", "int", "str"],
          correctAnswer: "float",
          explanation: "float() converts an integer to a floating-point number.",
        },
        rawText: "{}",
        usage: {
          operation: "generateStructured:assessment",
          task: "assessment",
          provider: "openrouter",
          model: "openai/gpt-4o",
          promptTokens: 150,
          completionTokens: 60,
          totalTokens: 210,
          latencyMs: 120,
          estimatedCost: 0.000975,
          status: "SUCCESS",
        },
        model: "openai/gpt-4o",
        promptVersion: "ASSESSMENT_GEN_V1",
      });

      const comp = {
        id: "py-variables-types",
        domainId: "python-junior",
        title: "Variables and Types",
        description: "Core primitive data types in Python",
        category: "CONCEPTUAL" as const,
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE" as const,
        provenance: "CURATED" as const,
      };

      const result = await generateIndependentAssessmentItemWithAI({
        competency: comp,
        domainId: "python-junior",
        formType: "FINAL",
        baselinePromptsToAvoid: ["What is type(4.0 / 2)?"],
        userId: userA,
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          task: "assessment",
        })
      );
      expect(result.success).toBe(true);
      expect(result.item?.itemType).toBe("MULTIPLE_CHOICE");
      expect(result.item?.correctAnswer).toBe("float");
      expect(result.item?.provenance).toBe("AI_GENERATED");
    });

    it("handles AI generation failure gracefully without crashing process", async () => {
      vi.spyOn(aiGateway, "generateStructured").mockRejectedValueOnce(
        new Error("AI Gateway timeout")
      );

      const comp = {
        id: "py-variables-types",
        domainId: "python-junior",
        title: "Variables and Types",
        description: "Core primitive data types in Python",
        category: "CONCEPTUAL" as const,
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE" as const,
        provenance: "CURATED" as const,
      };

      const result = await generateIndependentAssessmentItemWithAI({
        competency: comp,
        domainId: "python-junior",
        formType: "FINAL",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("AI Gateway timeout");
    });
  });
});
