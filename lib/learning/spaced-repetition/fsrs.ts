import {
  ReviewRating,
  SchedulerState,
  SchedulingResult,
  SpacedRepetitionScheduler,
} from "./types";

export const FSRS_VERSION = "v1";

/**
 * FSRS (Free Spaced Repetition Scheduler) Implementation (§11)
 * Mathematical model based on Stability (S), Difficulty (D), and Retrievability (R).
 * Stability represents the interval (in days) during which retrievability drops to 90%.
 */
export class FSRSScheduler implements SpacedRepetitionScheduler {
  readonly schedulerType = "FSRS";
  readonly schedulerVersion = FSRS_VERSION;

  private readonly targetRetention = 0.90;
  // Factor ensuring R(S, S) = 0.90 when exponent is -0.5: (19/81)
  private readonly decayFactor = 19 / 81;

  initItem(referenceDate: Date = new Date()): SchedulerState {
    return {
      schedulerType: "FSRS",
      schedulerVersion: this.schedulerVersion,
      stability: 1.0,
      difficulty: 5.0,
      reps: 0,
      lapses: 0,
      dueDate: referenceDate.toISOString(),
      customData: {},
    };
  }

  getRetrievability(state: SchedulerState, currentDate: Date = new Date()): number {
    if (!state.lastReviewDate) {
      return 1.0;
    }

    const lastDate = new Date(state.lastReviewDate);
    const elapsedDays = Math.max(0, (currentDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const stability = Math.max(0.1, state.stability);

    // R = (1 + factor * t / S)^(-0.5)
    const r = Math.pow(1 + this.decayFactor * (elapsedDays / stability), -0.5);
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
    const currentR = this.getRetrievability(state, reviewDate);

    let nextStability: number;
    let nextDifficulty: number;
    const nextReps = state.reps + 1;
    let nextLapses = state.lapses;

    if (state.reps === 0) {
      // First review initialization
      switch (rating) {
        case "AGAIN":
          nextStability = 0.5;
          nextDifficulty = 7.0;
          nextLapses += 1;
          break;
        case "HARD":
          nextStability = 1.2;
          nextDifficulty = 6.0;
          break;
        case "GOOD":
          nextStability = 3.0;
          nextDifficulty = 5.0;
          break;
        case "EASY":
          nextStability = 7.0;
          nextDifficulty = 3.5;
          break;
      }
    } else {
      // Subsequent review update
      // 1. Difficulty update
      let deltaD = 0;
      switch (rating) {
        case "AGAIN":
          deltaD = 1.5;
          break;
        case "HARD":
          deltaD = 0.6;
          break;
        case "GOOD":
          deltaD = -0.2;
          break;
        case "EASY":
          deltaD = -0.8;
          break;
      }
      nextDifficulty = Math.min(10.0, Math.max(1.0, Number((state.difficulty + deltaD).toFixed(2))));

      // 2. Stability update
      if (rating === "AGAIN") {
        // Memory lapse: significant stability reduction
        nextStability = Math.max(0.3, Number((state.stability * 0.25).toFixed(2)));
        nextLapses += 1;
      } else {
        // Successful retrieval: stability growth modulated by retrievability and difficulty
        const diffMultiplier = (11 - nextDifficulty) / 6;
        let ratingMultiplier = 1.0;
        if (rating === "HARD") ratingMultiplier = 0.75;
        if (rating === "EASY") ratingMultiplier = 1.35;

        // Growth is higher when retrieved at lower retrievability (desirable difficulty)
        const growth = 1 + (0.8 * diffMultiplier * ratingMultiplier * (1.1 - currentR));
        nextStability = Number((state.stability * Math.max(1.1, growth)).toFixed(2));
      }
    }

    // Interval calculation (target retention = 90% -> interval = stability)
    let intervalDays: number;
    if (rating === "AGAIN") {
      intervalDays = 1; // Due next day (or within current cycle)
    } else {
      intervalDays = Math.max(1, Math.round(nextStability));
    }

    const nextDueDate = new Date(reviewDate.getTime() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

    const nextState: SchedulerState = {
      schedulerType: "FSRS",
      schedulerVersion: this.schedulerVersion,
      stability: nextStability,
      difficulty: nextDifficulty,
      reps: nextReps,
      lapses: nextLapses,
      lastReviewDate: nowIso,
      dueDate: nextDueDate,
      customData: {
        lastRating: rating,
        retrievabilityAtReview: currentR,
      },
    };

    return {
      nextState,
      intervalDays,
      dueDate: nextDueDate,
      retrievability: this.getRetrievability(nextState, reviewDate),
    };
  }
}
