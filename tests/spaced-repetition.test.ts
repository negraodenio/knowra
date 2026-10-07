import { describe, it, expect } from "vitest";
import { getScheduler } from "@/lib/learning/spaced-repetition/scheduler";
import { FSRSScheduler } from "@/lib/learning/spaced-repetition/fsrs";
import { SM2Scheduler } from "@/lib/learning/spaced-repetition/sm2";

describe("Spaced Repetition Scheduler Abstraction (§11, §18, §32)", () => {
  const baseDate = new Date("2026-10-01T10:00:00Z");

  describe("FSRS Scheduler Engine", () => {
    const fsrs = new FSRSScheduler();

    it("initializes an item with proper FSRS state", () => {
      const state = fsrs.initItem(baseDate);
      expect(state.schedulerType).toBe("FSRS");
      expect(state.stability).toBe(1.0);
      expect(state.difficulty).toBe(5.0);
      expect(state.reps).toBe(0);
      expect(state.lapses).toBe(0);
      expect(state.dueDate).toBe(baseDate.toISOString());
      expect(fsrs.isDue(state, baseDate)).toBe(true);
    });

    it("evaluates retrievability decay accurately", () => {
      const state = fsrs.initItem(baseDate);
      state.lastReviewDate = baseDate.toISOString();
      state.stability = 10.0; // 10 days stability

      // At day 0: R = 1.0
      expect(fsrs.getRetrievability(state, baseDate)).toBe(1.0);

      // At day 10 (t = S): R should be approximately 0.90
      const day10 = new Date("2026-10-11T10:00:00Z");
      const rDay10 = fsrs.getRetrievability(state, day10);
      expect(rDay10).toBeGreaterThanOrEqual(0.89);
      expect(rDay10).toBeLessThanOrEqual(0.91);

      // At day 30 (t > S): R should decay further
      const day30 = new Date("2026-10-31T10:00:00Z");
      const rDay30 = fsrs.getRetrievability(state, day30);
      expect(rDay30).toBeLessThan(rDay10);
      expect(rDay30).toBeGreaterThan(0.5);
    });

    it("first review establishes initial stability according to rating", () => {
      const initial = fsrs.initItem(baseDate);

      const againRes = fsrs.review(initial, "AGAIN", baseDate);
      expect(againRes.nextState.stability).toBe(0.5);
      expect(againRes.nextState.lapses).toBe(1);

      const goodRes = fsrs.review(initial, "GOOD", baseDate);
      expect(goodRes.nextState.stability).toBe(3.0);
      expect(goodRes.nextState.difficulty).toBe(5.0);
      expect(goodRes.intervalDays).toBe(3);

      const easyRes = fsrs.review(initial, "EASY", baseDate);
      expect(easyRes.nextState.stability).toBe(7.0);
      expect(easyRes.nextState.difficulty).toBe(3.5);
      expect(easyRes.intervalDays).toBe(7);
    });

    it("subsequent successful reviews expand intervals", () => {
      const initial = fsrs.initItem(baseDate);
      const rev1 = fsrs.review(initial, "GOOD", baseDate);

      const day3 = new Date(rev1.dueDate);
      const rev2 = fsrs.review(rev1.nextState, "GOOD", day3);

      expect(rev2.nextState.stability).toBeGreaterThan(rev1.nextState.stability);
      expect(rev2.intervalDays).toBeGreaterThanOrEqual(rev1.intervalDays);
      expect(rev2.nextState.reps).toBe(2);
    });

    it("memory lapse (AGAIN) drastically penalizes stability and increments lapses", () => {
      const initial = fsrs.initItem(baseDate);
      const rev1 = fsrs.review(initial, "GOOD", baseDate);
      expect(rev1.nextState.stability).toBe(3.0);

      const day3 = new Date(rev1.dueDate);
      const lapseRev = fsrs.review(rev1.nextState, "AGAIN", day3);

      expect(lapseRev.nextState.stability).toBeLessThan(rev1.nextState.stability);
      expect(lapseRev.nextState.lapses).toBe(1);
      expect(lapseRev.intervalDays).toBe(1);
    });
  });

  describe("SM-2 Fallback Engine", () => {
    const sm2 = new SM2Scheduler();

    it("initializes SM-2 item with EF 2.5", () => {
      const state = sm2.initItem(baseDate);
      expect(state.schedulerType).toBe("SM2");
      expect(state.difficulty).toBe(2.5); // EF = 2.5
      expect(state.stability).toBe(1.0); // Interval = 1
      expect(state.reps).toBe(0);
    });

    it("follows classic SM-2 intervals: 1 -> 6 -> round(6 * EF)", () => {
      const initial = sm2.initItem(baseDate);

      // Rep 1 (GOOD): interval = 1
      const rev1 = sm2.review(initial, "GOOD", baseDate);
      expect(rev1.intervalDays).toBe(1);
      expect(rev1.nextState.reps).toBe(1);

      // Rep 2 (GOOD): interval = 6
      const rev2 = sm2.review(rev1.nextState, "GOOD", new Date(rev1.dueDate));
      expect(rev2.intervalDays).toBe(6);
      expect(rev2.nextState.reps).toBe(2);

      // Rep 3 (GOOD): interval = round(6 * EF)
      const rev3 = sm2.review(rev2.nextState, "GOOD", new Date(rev2.dueDate));
      expect(rev3.intervalDays).toBeGreaterThan(6);
      expect(rev3.nextState.reps).toBe(3);
    });

    it("AGAIN resets repetition counter in SM-2", () => {
      const initial = sm2.initItem(baseDate);
      const rev1 = sm2.review(initial, "GOOD", baseDate);
      const rev2 = sm2.review(rev1.nextState, "GOOD", new Date(rev1.dueDate));
      expect(rev2.nextState.reps).toBe(2);

      const failRev = sm2.review(rev2.nextState, "AGAIN", new Date(rev2.dueDate));
      expect(failRev.intervalDays).toBe(1);
      expect(failRev.nextState.reps).toBe(0);
      expect(failRev.nextState.lapses).toBe(1);
    });
  });

  describe("Scheduler Factory", () => {
    it("resolves FSRS as default and supports SM2 fallback", () => {
      const defaultScheduler = getScheduler();
      expect(defaultScheduler.schedulerType).toBe("FSRS");

      const fsrsExplicit = getScheduler("FSRS");
      expect(fsrsExplicit.schedulerType).toBe("FSRS");

      const sm2Explicit = getScheduler("SM2");
      expect(sm2Explicit.schedulerType).toBe("SM2");
    });
  });
});
