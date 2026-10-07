import { describe, it, expect } from "vitest";
import {
  getMasteryState,
  CompetencySchema,
  EvidenceRecordSchema,
  RecommendationSchema,
} from "@/lib/learning/types";

describe("Learning Engine Foundation Schemas & Rules", () => {
  describe("Mastery State Calculation (§16)", () => {
    it("maps scores to correct mastery states", () => {
      expect(getMasteryState(0)).toBe("CRITICAL");
      expect(getMasteryState(39)).toBe("CRITICAL");
      expect(getMasteryState(40)).toBe("LOW");
      expect(getMasteryState(59)).toBe("LOW");
      expect(getMasteryState(60)).toBe("DEVELOPING");
      expect(getMasteryState(74)).toBe("DEVELOPING");
      expect(getMasteryState(75)).toBe("GOOD");
      expect(getMasteryState(89)).toBe("GOOD");
      expect(getMasteryState(90)).toBe("MASTERY");
      expect(getMasteryState(100)).toBe("MASTERY");
    });
  });

  describe("Competency Schema Validation (§8)", () => {
    it("validates valid curated competency", () => {
      const valid = {
        id: "py-vars",
        domainId: "python-junior",
        title: "Variables and Assignment",
        description: "Declaring and manipulating variables in Python",
        category: "CONCEPTUAL",
        prerequisites: [],
        difficulty: 1,
        version: 1,
        status: "ACTIVE",
        provenance: "CURATED",
      };

      const result = CompetencySchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects invalid categories outside taxonomy (§7)", () => {
      const invalid = {
        id: "py-vars",
        domainId: "python-junior",
        title: "Variables",
        description: "Description",
        category: "INTUITIVE", // invalid
      };

      const result = CompetencySchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("Evidence Record Validation (§14)", () => {
    it("validates append-oriented evidence", () => {
      const evidence = {
        learnerId: "123e4567-e89b-12d3-a456-426614174000",
        competencyId: "py-vars",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 95.5,
        confidence: 0.85,
        source: "exercise-engine-v1",
      };

      const result = EvidenceRecordSchema.safeParse(evidence);
      expect(result.success).toBe(true);
    });

    it("rejects evidence with invalid score bounds", () => {
      const invalidScore = {
        learnerId: "123e4567-e89b-12d3-a456-426614174000",
        competencyId: "py-vars",
        evidenceType: "EXERCISE",
        result: "SUCCESS",
        score: 150, // out of bounds (max 100)
        confidence: 0.9,
        source: "test",
      };

      const result = EvidenceRecordSchema.safeParse(invalidScore);
      expect(result.success).toBe(false);
    });
  });

  describe("Next Best Action / Recommendation Schema (§20)", () => {
    it("validates explainable next best action recommendations", () => {
      const rec = {
        action: "REMEDIATE",
        competencyId: "python-functions",
        priority: 0.91,
        reason: "Low mastery and repeated recent failures in parameter passing.",
        estimatedMinutes: 20,
      };

      const result = RecommendationSchema.safeParse(rec);
      expect(result.success).toBe(true);
    });
  });
});
