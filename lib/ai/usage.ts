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

  // S7.5 Model Orchestrator Telemetry
  orchestrationPolicy?: string;
  selectionReason?: string;
  fallbackUsed?: boolean;
  fallbackModel?: string;
  fallbackReason?: string;
}

export interface ModelObservabilityStats {
  model: string;
  task: string;
  callCount: number;
  successCount: number;
  failureCount: number;
  schemaErrorCount: number;
  totalTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
  fallbackCount: number;
}

export class TelemetryService {
  private inMemoryRecords: AIUsageRecord[] = [];
  private readonly maxRecords = 500;

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

    // Keep bounded history for observability
    this.inMemoryRecords.push(fullRecord);
    if (this.inMemoryRecords.length > this.maxRecords) {
      this.inMemoryRecords.shift();
    }

    logger.info("AI Usage Recorded", {
      operation: fullRecord.operation,
      task: fullRecord.task,
      model: fullRecord.model,
      tokens: fullRecord.totalTokens,
      cost: fullRecord.estimatedCost,
      latencyMs: fullRecord.latencyMs,
      status: fullRecord.status,
      orchestrationPolicy: fullRecord.orchestrationPolicy,
      fallbackUsed: fullRecord.fallbackUsed,
    });

    return fullRecord;
  }

  getUsageRecords(task?: string, model?: string): AIUsageRecord[] {
    return this.inMemoryRecords.filter((r) => {
      if (task && r.task.toLowerCase() !== task.toLowerCase()) return false;
      if (model && r.model !== model) return false;
      return true;
    });
  }

  getModelObservabilityStats(): Record<string, ModelObservabilityStats> {
    const stats: Record<string, ModelObservabilityStats> = {};

    for (const record of this.inMemoryRecords) {
      const key = `${record.model}:${record.task}`;
      if (!stats[key]) {
        stats[key] = {
          model: record.model,
          task: record.task,
          callCount: 0,
          successCount: 0,
          failureCount: 0,
          schemaErrorCount: 0,
          totalTokens: 0,
          estimatedCost: 0,
          avgLatencyMs: 0,
          fallbackCount: 0,
        };
      }

      const s = stats[key];
      s.callCount += 1;
      if (record.status === "SUCCESS") s.successCount += 1;
      else if (record.status === "FAILED") s.failureCount += 1;
      else if (record.status === "SCHEMA_ERROR") s.schemaErrorCount += 1;

      if (record.fallbackUsed) s.fallbackCount += 1;

      s.totalTokens += record.totalTokens;
      s.estimatedCost = Number((s.estimatedCost + record.estimatedCost).toFixed(6));
      s.avgLatencyMs = Math.round(
        (s.avgLatencyMs * (s.callCount - 1) + record.latencyMs) / s.callCount
      );
    }

    return stats;
  }

  clearUsageRecords(): void {
    this.inMemoryRecords = [];
  }
}

export const telemetryService = new TelemetryService();
