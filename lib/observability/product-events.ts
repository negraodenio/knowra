import { randomUUID as uuidv4 } from "crypto";
import { logger } from "./logger";

export type ProductEventType =
  | "goal_created"
  | "goal_updated"
  | "diagnostic_started"
  | "diagnostic_completed"
  | "learning_map_viewed"
  | "recommendation_presented"
  | "recommendation_accepted"
  | "activity_started"
  | "activity_completed"
  | "evidence_emitted"
  | "mastery_changed"
  | "gap_detected"
  | "gap_resolved"
  | "review_started"
  | "review_completed"
  | "assessment_started"
  | "assessment_completed"
  | "learning_gain_recorded"
  | "retention_recorded";

export interface ProductEvent {
  id: string;
  seq: number;
  userId: string;
  goalId?: string;
  domainId?: string;
  eventType: ProductEventType;
  payload: Record<string, unknown>;
  timestamp: string;
}

class ProductEventService {
  private events: ProductEvent[] = [];
  private counter: number = 0;

  recordEvent(
    userId: string,
    eventType: ProductEventType,
    payload: Record<string, unknown> = {},
    goalId?: string,
    domainId?: string
  ): ProductEvent {
    this.counter += 1;
    const event: ProductEvent = {
      id: uuidv4(),
      seq: this.counter,
      userId,
      goalId,
      domainId,
      eventType,
      payload,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);

    logger.info(`PRODUCT_EVENT: ${eventType}`, {
      userId,
      goalId,
      domainId,
      eventType,
      ...payload,
    });

    return event;
  }

  getUserEvents(userId: string, goalId?: string): ProductEvent[] {
    return this.events
      .filter((e) => e.userId === userId && (!goalId || e.goalId === goalId))
      .sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        return timeDiff !== 0 ? timeDiff : b.seq - a.seq;
      });
  }

  clearEvents(): void {
    this.events = [];
  }
}

export const productEventService = new ProductEventService();
