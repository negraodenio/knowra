import { logger } from "@/lib/observability/logger";
import { calculateEstimatedCost } from "./models";

export interface AIUsageRecord {
  id?: string;
  userId?: string;
  operation: string;
  task: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCost: number;
  status: "SUCCESS" | "FAILED" | "SCHEMA_ERROR";
  errorMessage?: string;
  timestamp?: string;
}

export class TelemetryService {
  async recordUsage(record: Omit<AIUsageRecord, "estimatedCost" | "totalTokens">): Promise<AIUsageRecord> {
    const totalTokens = record.promptTokens + record.completionTokens;
    const estimatedCost = calculateEstimatedCost(
      record.model,
      record.promptTokens,
      record.completionTokens
    );

    const fullRecord: AIUsageRecord = {
      ...record,
      totalTokens,
      estimatedCost,
      timestamp: new Date().toISOString(),
    };

    logger.info("AI Usage Recorded", {
      operation: fullRecord.operation,
      task: fullRecord.task,
      model: fullRecord.model,
      tokens: fullRecord.totalTokens,
      cost: fullRecord.estimatedCost,
      latencyMs: fullRecord.latencyMs,
      status: fullRecord.status,
    });

    return fullRecord;
  }
}

export const telemetryService = new TelemetryService();
