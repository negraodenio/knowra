import { describe, it, expect } from "vitest";
import { calculateMastery, calculateRecencyWeight } from "@/lib/learning/mastery";
import { EvidenceRecord } from "@/lib/learning/types";

describe("Mastery Engine Calculations (§5, §6, §7, §8, §11, §37)", () => {
  const learnerId = "user-test-1";
  const now = new Date("2026-10-07T12:00:00Z");

  describe("Conceptual Category Mastery Formula (§7, §63)", () => {
    it("matches exact specification example when all components are present (§63)", () => {
      // Diagnostic = 60 (0.15)
      // Exercise = 80 (0.40)
      // Feynman = 70 (0.25)
      // Review = 90 (0.20)
      // Expected = 0.40(80) + 0.25(70) + 0.20(90) + 0.15(60) = 32 + 17.5 + 18 + 9 = 76.5 => GOOD
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "DIAGNOSTIC",
          result: "PARTIAL",
          score: 60,
          confidence: 0.5,
          source: "diag",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "EXERCISE",
          result: "SUCCESS",
          score: 80,
          confidence: 0.8,
          source: "ex",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "FEYNMAN",
          result: "SUCCESS",
          score: 70,
          confidence: 0.75,
          source: "feynman",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "REVIEW",
          result: "SUCCESS",
          score: 90,
          confidence: 0.85,
          source: "rev",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      const result = calculateMastery("py-functions", "CONCEPTUAL", evidenceList, {
        referenceDate: now,
      });

      expect(result.masteryScore).toBe(76.5);
      expect(result.masteryState).toBe("GOOD");
      expect(result.calculationVersion).toBe("v1");
    });

    it("renormalizes weights when Feynman and Review are missing (§8, §64)", () => {
      // Diagnostic = 60 (configured weight 0.15)
      // Exercise = 80 (configured weight 0.40)
      // Sum = 0.55.
      // Normalized: exercise = 0.40/0.55 (~0.7273), diagnostic = 0.15/0.55 (~0.2727)
      // Expected = 80*(0.40/0.55) + 60*(0.15/0.55) = 58.1818 + 16.3636 = 74.55
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "DIAGNOSTIC",
          result: "PARTIAL",
          score: 60,
          confidence: 0.5,
          source: "diag",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "EXERCISE",
          result: "SUCCESS",
          score: 80,
          confidence: 0.8,
          source: "ex",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      const result = calculateMastery("py-functions", "CONCEPTUAL", evidenceList, {
        referenceDate: now,
      });

      expect(result.masteryScore).toBeCloseTo(74.55, 2);
      expect(result.masteryState).toBe("DEVELOPING");
      // Verify missing components are NOT treated as 0
      expect(result.componentScores["feynman"]).toBeUndefined();
      expect(result.componentScores["review"]).toBeUndefined();
    });

    it("renormalizes to 100% when only diagnostic evidence is present", () => {
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "py-functions",
          evidenceType: "DIAGNOSTIC",
          result: "SUCCESS",
          score: 85,
          confidence: 0.4,
          source: "diag",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      const result = calculateMastery("py-functions", "CONCEPTUAL", evidenceList, {
        referenceDate: now,
      });

      expect(result.masteryScore).toBe(85);
      expect(result.masteryState).toBe("GOOD");
    });
  });

  describe("Procedural Category Mastery Formula (§7, §65)", () => {
    it("gives application dominant weight (0.55) in procedural competencies", () => {
      // Application = 90 (0.55)
      // Exercise = 75 (0.20)
      // Diagnostic = 70 (0.10)
      // Missing Review (0.15). Sum = 0.85
      // Norm weights: App = 0.55/0.85 (~0.6471), Ex = 0.20/0.85 (~0.2353), Diag = 0.10/0.85 (~0.1176)
      // Expected = 90*(0.55/0.85) + 75*(0.20/0.85) + 70*(0.10/0.85) = 58.235 + 17.647 + 8.235 = 84.12
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "xl-xlookup",
          evidenceType: "DIAGNOSTIC",
          result: "SUCCESS",
          score: 70,
          confidence: 0.4,
          source: "diag",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "xl-xlookup",
          evidenceType: "EXERCISE",
          result: "SUCCESS",
          score: 75,
          confidence: 0.7,
          source: "ex",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "xl-xlookup",
          evidenceType: "APPLICATION",
          result: "SUCCESS",
          score: 90,
          confidence: 0.9,
          source: "app",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      const result = calculateMastery("xl-xlookup", "PROCEDURAL", evidenceList, {
        referenceDate: now,
      });

      expect(result.masteryScore).toBeCloseTo(84.12, 1);
      expect(result.masteryState).toBe("GOOD");
    });
  });

  describe("Factual Category Mastery Formula (§7, §38)", () => {
    it("weights exercises (0.60) and reviews (0.30) heavily for factual competencies", () => {
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "math-trig-ratios",
          evidenceType: "EXERCISE",
          result: "SUCCESS",
          score: 90,
          confidence: 0.8,
          source: "ex",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "math-trig-ratios",
          evidenceType: "REVIEW",
          result: "SUCCESS",
          score: 100,
          confidence: 0.85,
          source: "rev",
          timestamp: now.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      // Missing diagnostic (0.10). Available sum = 0.90
      // Exercise: 0.60/0.90 = 2/3. Review: 0.30/0.90 = 1/3
      // Expected = 90*(2/3) + 100*(1/3) = 60 + 33.33 = 93.33 => MASTERY
      const result = calculateMastery("math-trig-ratios", "FACTUAL", evidenceList, {
        referenceDate: now,
      });

      expect(result.masteryScore).toBeCloseTo(93.33, 2);
      expect(result.masteryState).toBe("MASTERY");
    });
  });

  describe("Recency Decay Effect (§11, §41, §50)", () => {
    it("weights recent evidence more heavily than old evidence within the same component", () => {
      const oldDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago (2 half-lives)
      const recentDate = now;

      // Old exercise score = 90 (decayed weight ~ 0.25)
      // Recent exercise score = 40 (weight = 1.0)
      const evidenceList: EvidenceRecord[] = [
        {
          learnerId,
          competencyId: "py-loops",
          evidenceType: "EXERCISE",
          result: "SUCCESS",
          score: 90,
          confidence: 0.8,
          source: "ex-old",
          timestamp: oldDate.toISOString(),
          metadata: {},
          version: 1,
        },
        {
          learnerId,
          competencyId: "py-loops",
          evidenceType: "EXERCISE",
          result: "FAILURE",
          score: 40,
          confidence: 0.8,
          source: "ex-recent",
          timestamp: recentDate.toISOString(),
          metadata: {},
          version: 1,
        },
      ];

      const result = calculateMastery("py-loops", "CONCEPTUAL", evidenceList, {
        referenceDate: now,
      });

      // Without recency, average would be (90+40)/2 = 65.
      // With recency, it must be significantly closer to recent score (40)
      expect(result.masteryScore).toBeLessThan(55);
      expect(result.masteryScore).toBeGreaterThan(40);
    });

    it("calculates recency weights accurately according to exponential half-life formula", () => {
      const zeroDays = calculateRecencyWeight(now.toISOString(), now, { halfLifeDays: 45 });
      expect(zeroDays).toBeCloseTo(1.0, 3);

      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
      const halfWeight = calculateRecencyWeight(fortyFiveDaysAgo.toISOString(), now, { halfLifeDays: 45 });
      expect(halfWeight).toBeCloseTo(0.5, 2);
    });
  });
});
