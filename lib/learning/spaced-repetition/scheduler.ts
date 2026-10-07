import { FSRSScheduler } from "./fsrs";
import { SM2Scheduler } from "./sm2";
import { SpacedRepetitionScheduler, SchedulerType } from "./types";

export * from "./types";
export * from "./fsrs";
export * from "./sm2";

const fsrsInstance = new FSRSScheduler();
const sm2Instance = new SM2Scheduler();

/**
 * Spaced Repetition Scheduler Factory (§11)
 * Defaults to FSRS, supports SM-2 fallback.
 */
export function getScheduler(type: SchedulerType = "FSRS"): SpacedRepetitionScheduler {
  switch (type) {
    case "FSRS":
      return fsrsInstance;
    case "SM2":
      return sm2Instance;
    default:
      return fsrsInstance;
  }
}
