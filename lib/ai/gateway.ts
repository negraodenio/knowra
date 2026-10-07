import { z } from "zod";
import { openRouterClient, OpenRouterMessage } from "./openrouter";
import { getModelForTask, AITask } from "./models";
import { telemetryService, AIUsageRecord } from "./usage";
import { logger } from "@/lib/observability/logger";

export interface GenerateTextOptions {
  task: AITask;
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  userId?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateStructuredOptions<T extends z.ZodTypeAny> extends GenerateTextOptions {
  schema: T;
}

export interface AIGatewayResult<T> {
  data: T;
  rawText: string;
  usage: AIUsageRecord;
  model: string;
  promptVersion: string;
}

export class AIGateway {
  /**
   * Generates a raw text completion through the OpenRouter gateway.
   */
  async generateText(options: GenerateTextOptions): Promise<AIGatewayResult<string>> {
    const { task, systemPrompt, userPrompt, promptVersion, userId, temperature, maxTokens } = options;
    const model = getModelForTask(task);
    const startTime = Date.now();

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await openRouterClient.complete({
        model,
        messages,
        temperature,
        maxTokens,
      });

      const latencyMs = Date.now() - startTime;
      const usage = await telemetryService.recordUsage({
        userId,
        operation: `generateText:${task}`,
        task,
        provider: "openrouter",
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        latencyMs,
        status: "SUCCESS",
      });

      return {
        data: response.content,
        rawText: response.content,
        usage,
        model: response.model,
        promptVersion,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await telemetryService.recordUsage({
        userId,
        operation: `generateText:${task}`,
        task,
        provider: "openrouter",
        model,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs,
        status: "FAILED",
        errorMessage,
      });

      logger.error(`AI Gateway generation failed for task ${task}`, err, { task, model, promptVersion });
      throw err;
    }
  }

  /**
   * Generates a structured output validated strictly against a Zod schema (§32).
   * Strips markdown fences if present and handles schema validation errors.
   */
  async generateStructured<T extends z.ZodTypeAny>(
    options: GenerateStructuredOptions<T>
  ): Promise<AIGatewayResult<z.infer<T>>> {
    const { task, systemPrompt, userPrompt, promptVersion, schema, userId, temperature, maxTokens } = options;
    const model = getModelForTask(task);
    const startTime = Date.now();

    const formattedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond ONLY with valid JSON matching the requested schema. Do not enclose in markdown code blocks if possible.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: formattedSystemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await openRouterClient.complete({
        model,
        messages,
        temperature,
        maxTokens,
        responseFormat: { type: "json_object" },
      });

      const latencyMs = Date.now() - startTime;
      let cleanedContent = response.content.trim();

      // Clean up markdown code blocks if returned
      if (cleanedContent.startsWith("```json")) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, "").replace(/```$/, "").trim();
      } else if (cleanedContent.startsWith("```")) {
        cleanedContent = cleanedContent.replace(/^```\s*/, "").replace(/```$/, "").trim();
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(cleanedContent);
      } catch (jsonErr) {
        await telemetryService.recordUsage({
          userId,
          operation: `generateStructured:${task}`,
          task,
          provider: "openrouter",
          model: response.model,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          latencyMs,
          status: "SCHEMA_ERROR",
          errorMessage: `JSON parse failed: ${String(jsonErr)}`,
        });
        throw new Error(`Failed to parse AI output as JSON: ${cleanedContent}`);
      }

      const parseResult = schema.safeParse(parsedJson);
      if (!parseResult.success) {
        await telemetryService.recordUsage({
          userId,
          operation: `generateStructured:${task}`,
          task,
          provider: "openrouter",
          model: response.model,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          latencyMs,
          status: "SCHEMA_ERROR",
          errorMessage: `Zod validation error: ${parseResult.error.message}`,
        });
        throw new Error(`AI output failed schema validation: ${parseResult.error.message}`);
      }

      const usage = await telemetryService.recordUsage({
        userId,
        operation: `generateStructured:${task}`,
        task,
        provider: "openrouter",
        model: response.model,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        latencyMs,
        status: "SUCCESS",
      });

      return {
        data: parseResult.data,
        rawText: response.content,
        usage,
        model: response.model,
        promptVersion,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      logger.error(`AI Gateway structured generation failed for task ${task}`, err, {
        task,
        model,
        promptVersion,
        latencyMs,
        errorMessage,
      });
      throw err;
    }
  }
}

export const aiGateway = new AIGateway();
