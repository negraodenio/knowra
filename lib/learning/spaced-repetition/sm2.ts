import {
  ReviewRating,
  SchedulerState,
  SchedulingResult,
  SpacedRepetitionScheduler,
} from "./types";

export const SM2_VERSION = "v1";

/**
 * SuperMemo 2 (SM-2) Fallback Implementation (§11)
 * Classic spaced repetition algorithm using Easiness Factor (EF) and repetition counts.
 */
export class SM2Scheduler implements SpacedRepetitionScheduler {
  readonly schedulerType = "SM2";
  readonly schedulerVersion = SM2_VERSION;

  initItem(referenceDate: Date = new Date()): SchedulerState {
    return {
      schedulerType: "SM2",
      schedulerVersion: this.schedulerVersion,
      stability: 1.0,
      difficulty: 2.5, // Used as EF (Easiness Factor)
      reps: 0,
      lapses: 0,
      dueDate: referenceDate.toISOString(),
      customData: { intervalDays: 1 },
    };
  }

  getRetrievability(state: SchedulerState, currentDate: Date = new Date()): number {
    if (!state.lastReviewDate) return 1.0;

    const lastDate = new Date(state.lastReviewDate);
    const elapsedDays = Math.max(0, (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const interval = Math.max(1, state.stability);

    // Exponential retrievability decay approximation
    const r = Math.exp(-0.105 * (elapsedDays / interval));
    return Math.min(1.0, Math.max(0.0, Number(r.toFixed(4))));
  }

  isDue(state: SchedulerState, currentDate: Date = new Date()): boolean {
    const dueTime = new Date(state.dueDate).getTime();
    return currentDate.getTime() >= dueTime;
  }

  review(
    state: SchedulerState,
    rating: ReviewRating,
    reviewDate: Date = new Date()
  ): SchedulingResult {
    const nowIso = reviewDate.toISOString();

    // Map rating to SM-2 quality (0 to 5)
    // AGAIN -> 1, HARD -> 3, GOOD -> 4, EASY -> 5
    let q = 4;
    switch (rating) {
      case "AGAIN":
        q = 1;
        break;
      case "HARD":
        q = 3;
        break;
      case "GOOD":
        q = 4;
        break;
      case "EASY":
        q = 5;
        break;
    }

    let ef = state.difficulty || 2.5;
    let reps = state.reps;
    let lapses = state.lapses;
    let interval: number;

    // EF update formula
    ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (ef < 1.3) ef = 1.3;
    ef = Number(ef.toFixed(2));

    if (q < 3) {
      // Lapse: reset interval to 1
      reps = 0;
      lapses += 1;
      interval = 1;
    } else {
      // Successful recall
      if (reps === 0) {
        interval = 1;
      } else if (reps === 1) {
        interval = 6;
      } else {
        const customInterval = typeof state.customData?.intervalDays === "number" ? state.customData.intervalDays : undefined;
        const prevInterval = customInterval ?? (state.stability || 6);
        interval = Math.round(prevInterval * ef);
      }
      reps += 1;
    }

    const nextDueDate = new Date(reviewDate.getTime() + interval * 24 * 60 * 60 * 1000).toISOString();

    const nextState: SchedulerState = {
      schedulerType: "SM2",
      schedulerVersion: this.schedulerVersion,
      stability: interval, // stability stores interval in SM-2
      difficulty: ef,
      reps,
      lapses,
      lastReviewDate: nowIso,
      dueDate: nextDueDate,
      customData: {
        intervalDays: interval,
        lastQuality: q,
      },
    };

    return {
      nextState,
      intervalDays: interval,
      dueDate: nextDueDate,
      retrievability: this.getRetrievability(nextState, reviewDate),
    };
  }
}
