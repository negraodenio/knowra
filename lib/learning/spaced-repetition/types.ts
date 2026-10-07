import { z } from "zod";

export const ReviewRatingSchema = z.enum(["AGAIN", "HARD", "GOOD", "EASY"]);
export type ReviewRating = z.infer<typeof ReviewRatingSchema>;

export const SchedulerTypeSchema = z.enum(["FSRS", "SM2"]);
export type SchedulerType = z.infer<typeof SchedulerTypeSchema>;

export interface SchedulerState {
  schedulerType: SchedulerType;
  schedulerVersion: string;
  stability: number;       // S (retrieval stability in days)
  difficulty: number;      // D (1 to 10 for FSRS, or EF 1.3 to 2.5 for SM-2)
  reps: number;
  lapses: number;
  lastReviewDate?: string;
  dueDate: string;
  customData?: Record<string, unknown>;
}

export interface SchedulingResult {
  nextState: SchedulerState;
  intervalDays: number;
  dueDate: string;
  retrievability: number; // estimated recall probability (0 to 1)
}

export interface SpacedRepetitionScheduler {
  schedulerType: SchedulerType;
  schedulerVersion: string;
  initItem(referenceDate?: Date): SchedulerState;
  review(state: SchedulerState, rating: ReviewRating, reviewDate?: Date): SchedulingResult;
  getRetrievability(state: SchedulerState, currentDate?: Date): number;
  isDue(state: SchedulerState, currentDate?: Date): boolean;
}
