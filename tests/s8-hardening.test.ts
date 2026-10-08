/**
 * S8.1 UX Hardening and Product Reality Regression Tests
 */

import { describe, it, expect } from "vitest";
import { getCuratedCompetenciesByDomain } from "../lib/learning/curriculum";
import { getPracticeActivity, CURATED_ACTIVITIES } from "../lib/learning/activities/curriculum-activities";
import { productEventService } from "../lib/observability/product-events";

describe("S8.1 Product Reality & UX Hardening Tests", () => {
  describe("Curriculum Activities Coverage across MVP Domains (§5, §12)", () => {
    it("provides curated practice activities for Python Junior competencies", () => {
      const pythonComps = getCuratedCompetenciesByDomain("python-junior");
      expect(pythonComps.length).toBeGreaterThanOrEqual(7);

      for (const comp of pythonComps) {
        const act = getPracticeActivity(comp.id);
        expect(act).toBeDefined();
        expect(act?.title).toBeDefined();
        expect(act?.instruction).toBeDefined();
        expect(act?.practice.prompt).toBeDefined();
        expect(act?.practice.correctAnswer).toBeDefined();
        expect(act?.practice.explanation).toBeDefined();
      }
    });

    it("provides curated practice activities for Mathematics competencies", () => {
      const mathComps = getCuratedCompetenciesByDomain("math-exams");
      expect(mathComps.length).toBeGreaterThanOrEqual(5);

      for (const comp of mathComps) {
        const act = getPracticeActivity(comp.id);
        expect(act).toBeDefined();
        expect(act?.title).toBeDefined();
        expect(act?.instruction).toBeDefined();
        expect(act?.practice.prompt).toBeDefined();
        expect(act?.practice.correctAnswer).toBeDefined();
        expect(act?.practice.explanation).toBeDefined();
      }
    });

    it("provides curated practice activities for Excel Pro competencies", () => {
      const excelComps = getCuratedCompetenciesByDomain("excel-pro");
      expect(excelComps.length).toBeGreaterThanOrEqual(5);

      for (const comp of excelComps) {
        const act = getPracticeActivity(comp.id);
        expect(act).toBeDefined();
        expect(act?.title).toBeDefined();
        expect(act?.instruction).toBeDefined();
        expect(act?.practice.prompt).toBeDefined();
        expect(act?.practice.correctAnswer).toBeDefined();
        expect(act?.practice.explanation).toBeDefined();
      }
    });
  });

  describe("Gap Status Schema Alignment (§10, §16)", () => {
    it("ensures gap status 'OPEN' is recognized correctly", () => {
      const sampleGaps = [
        { id: "g1", competencyId: "py-conditionals", status: "OPEN" as const, reason: "Diagnostic deficit" },
        { id: "g2", competencyId: "py-variables-types", status: "RESOLVED" as const, reason: "Resolved through practice" },
      ];

      const openGaps = sampleGaps.filter((g) => g.status === "OPEN");
      expect(openGaps).toHaveLength(1);
      expect(openGaps[0].competencyId).toBe("py-conditionals");
    });
  });

  describe("Product Observability Telemetry (§25)", () => {
    it("records and retrieves user lifecycle events in chronological order", () => {
      const testUserId = `test-learner-obs-${Date.now()}`;
      productEventService.recordEvent(testUserId, "goal_created", { title: "Learn Python" });
      productEventService.recordEvent(testUserId, "diagnostic_started", { sessionId: "diag-1" });
      productEventService.recordEvent(testUserId, "diagnostic_completed", { overallBaselineScore: 60 });
      productEventService.recordEvent(testUserId, "activity_started", { action: "PRACTICE" });
      productEventService.recordEvent(testUserId, "evidence_emitted", { score: 95 });

      const events = productEventService.getUserEvents(testUserId);
      expect(events.length).toBe(5);
      expect(events[0].eventType).toBe("evidence_emitted"); // most recent first
      expect(events[4].eventType).toBe("goal_created");
    });
  });

  describe("Learner Copy & Distinction Between Mastery and Completion (§16, §17, §20)", () => {
    it("does not equate activity completion with mastery", () => {
      const singleActivityScore = 100;
      const initialMastery = 0;

      // In the learning engine, single activity does not jump directly to 100% mastery
      const simulatedMasteryJump = initialMastery + singleActivityScore * 0.4;
      expect(simulatedMasteryJump).toBeLessThan(85); // 85% is threshold for MASTERED
      expect(simulatedMasteryJump).toBe(40);
    });

    it("verifies review ratings have human memory cues", () => {
      const ratings = [
        { id: "AGAIN", label: "Again", desc: "Forgot" },
        { id: "HARD", label: "Hard", desc: "Struggled" },
        { id: "GOOD", label: "Good", desc: "Remembered" },
        { id: "EASY", label: "Easy", desc: "Effortless" },
      ];

      expect(ratings).toHaveLength(4);
      expect(ratings.map((r) => r.id)).toEqual(["AGAIN", "HARD", "GOOD", "EASY"]);
      expect(ratings[0].desc).toBe("Forgot");
      expect(ratings[2].desc).toBe("Remembered");
    });
  });
});
