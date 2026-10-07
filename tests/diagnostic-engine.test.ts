import { describe, it, expect } from "vitest";
import {
  evaluateDiagnosticItem,
  calculateInitialConfidence,
  aggregateDiagnosticReport,
} from "@/lib/learning/diagnostic/evaluator";
import { DiagnosticItem, DiagnosticResponse } from "@/lib/learning/diagnostic/types";

describe("Diagnostic Evaluation & Confidence Engine (§20, §21, §22, §29)", () => {
  describe("Deterministic Item Evaluation", () => {
    it("evaluates multiple choice correctly (case-insensitive)", () => {
      const item: DiagnosticItem = {
        id: "mc-1",
        domainId: "python-junior",
        competencyId: "py-vars",
        prompt: "Choose the correct type",
        itemType: "MULTIPLE_CHOICE",
        difficulty: 1,
        correctAnswer: "int",
        version: 1,
        provenance: "CURATED",
        status: "ACTIVE",
      };

      expect(evaluateDiagnosticItem(item, "int")).toEqual({ isCorrect: true, score: 100 });
      expect(evaluateDiagnosticItem(item, "INT")).toEqual({ isCorrect: true, score: 100 });
      expect(evaluateDiagnosticItem(item, "float")).toEqual({ isCorrect: false, score: 0 });
    });

    it("evaluates numeric answers with float tolerance", () => {
      const item: DiagnosticItem = {
        id: "num-1",
        domainId: "math-exams",
        competencyId: "math-algebra",
        prompt: "Calculate slope",
        itemType: "NUMERIC",
        difficulty: 2,
        correctAnswer: "0.75",
        version: 1,
        provenance: "CURATED",
        status: "ACTIVE",
      };

      expect(evaluateDiagnosticItem(item, "0.750")).toEqual({ isCorrect: true, score: 100 });
      expect(evaluateDiagnosticItem(item, "0,75")).toEqual({ isCorrect: true, score: 100 });
      expect(evaluateDiagnosticItem(item, "0.85")).toEqual({ isCorrect: false, score: 0 });
    });

    it("evaluates short answer with normalized whitespace", () => {
      const item: DiagnosticItem = {
        id: "sa-1",
        domainId: "excel-pro",
        competencyId: "xl-math",
        prompt: "Function name",
        itemType: "SHORT_ANSWER",
        difficulty: 1,
        correctAnswer: "COUNTA",
        version: 1,
        provenance: "CURATED",
        status: "ACTIVE",
      };

      expect(evaluateDiagnosticItem(item, "  counta  ")).toEqual({ isCorrect: true, score: 100 });
      expect(evaluateDiagnosticItem(item, "COUNT")).toEqual({ isCorrect: false, score: 0 });
    });
  });

  describe("Initial Evidence Confidence Calculation (§20, §21)", () => {
    it("returns limited confidence (0.40) for a single diagnostic answer", () => {
      const singleCorrect = calculateInitialConfidence([{ isCorrect: true, score: 100 }]);
      expect(singleCorrect).toBe(0.40);

      const singleIncorrect = calculateInitialConfidence([{ isCorrect: false, score: 0 }]);
      expect(singleIncorrect).toBe(0.40);
    });

    it("increases confidence to 0.65 when two items are consistent", () => {
      const twoCorrect = calculateInitialConfidence([
        { isCorrect: true, score: 100 },
        { isCorrect: true, score: 100 },
      ]);
      expect(twoCorrect).toBe(0.65);
    });

    it("lowers confidence to 0.30 when two items conflict", () => {
      const conflicting = calculateInitialConfidence([
        { isCorrect: true, score: 100 },
        { isCorrect: false, score: 0 },
      ]);
      expect(conflicting).toBe(0.30);
    });

    it("increases confidence to 0.85 when 3+ items are consistently correct", () => {
      const threeCorrect = calculateInitialConfidence([
        { isCorrect: true, score: 100 },
        { isCorrect: true, score: 100 },
        { isCorrect: true, score: 100 },
      ]);
      expect(threeCorrect).toBe(0.85);
    });
  });

  describe("Diagnostic Report Aggregation (§18, §19, §39)", () => {
    it("aggregates competency baselines and designates lower baselines without calling them gaps", () => {
      const items: DiagnosticItem[] = [
        {
          id: "item-1",
          domainId: "python-junior",
          competencyId: "py-vars",
          prompt: "Q1",
          itemType: "MULTIPLE_CHOICE",
          difficulty: 1,
          correctAnswer: "A",
          version: 1,
          provenance: "CURATED",
          status: "ACTIVE",
        },
        {
          id: "item-2",
          domainId: "python-junior",
          competencyId: "py-funcs",
          prompt: "Q2",
          itemType: "MULTIPLE_CHOICE",
          difficulty: 2,
          correctAnswer: "B",
          version: 1,
          provenance: "CURATED",
          status: "ACTIVE",
        },
      ];

      const responses: DiagnosticResponse[] = [
        {
          id: "r1",
          sessionId: "sess-1",
          userId: "user-1",
          itemId: "item-1",
          competencyId: "py-vars",
          answer: "A",
          isCorrect: true,
          score: 100,
          submittedAt: new Date().toISOString(),
        },
        {
          id: "r2",
          sessionId: "sess-1",
          userId: "user-1",
          itemId: "item-2",
          competencyId: "py-funcs",
          answer: "C", // Wrong answer
          isCorrect: false,
          score: 0,
          submittedAt: new Date().toISOString(),
        },
      ];

      const report = aggregateDiagnosticReport(
        "sess-1",
        "goal-1",
        "python-junior",
        "1.0.0",
        items,
        responses
      );

      expect(report.overallBaselineScore).toBe(50);
      expect(report.relativeStrengths).toContain("py-vars");
      // Explicit requirement (§39): weak areas are designated lowerBaselines, NOT gaps
      expect(report.lowerBaselines).toContain("py-funcs");
      expect((report as unknown as Record<string, unknown>).gaps).toBeUndefined();
    });
  });
});
