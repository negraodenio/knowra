import { z } from "zod";
import { openRouterClient, OpenRouterMessage } from "./openrouter";
import { getModel, ModelTask, AITask } from "./models";
import { telemetryService, AIUsageRecord } from "./usage";
import { logger } from "@/lib/observability/logger";
import { getAIConfig } from "./config";

export type GatewayTask = ModelTask | AITask;

export interface GenerateTextOptions {
  task: GatewayTask;
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
  userId?: string;
  temperature?: number;
  maxTokens?: number;
  modelOverride?: string;
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
   * Convenience invocation method matching generate("task", prompt, options)
   */
  async generate(
    task: GatewayTask,
    prompt: string,
    options?: Partial<Omit<GenerateTextOptions, "task" | "userPrompt">>
  ): Promise<AIGatewayResult<string>> {
    return this.generateText({
      task,
      systemPrompt: options?.systemPrompt || "You are an AI assistant for the adaptive learning platform.",
      userPrompt: prompt,
      promptVersion: options?.promptVersion || `${String(task).toLowerCase()}_v1`,
      userId: options?.userId,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      modelOverride: options?.modelOverride,
    });
  }

  /**
   * Generates a raw text completion through the OpenRouter gateway.
   * Model selection is environment-driven and resolved per task from the registry.
   */
  async generateText(options: GenerateTextOptions): Promise<AIGatewayResult<string>> {
    const { task, systemPrompt, userPrompt, promptVersion, userId, temperature, maxTokens, modelOverride } = options;
    const model = modelOverride || getModel(task);
    const startTime = Date.now();
    const config = getAIConfig();

    const messages: OpenRouterMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await openRouterClient.complete({
        model,
        messages,
        temperature: temperature ?? config.temperature,
        maxTokens,
      });

      const latencyMs = Date.now() - startTime;
      const usage = await telemetryService.recordUsage({
        userId,
        operation: `generateText:${task}`,
        task: String(task).toLowerCase(),
        provider: config.provider,
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
        task: String(task).toLowerCase(),
        provider: config.provider,
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
   * Model selection is environment-driven and resolved per task from the registry.
   * Strips markdown fences if present and handles schema validation errors.
   */
  async generateStructured<T extends z.ZodTypeAny>(
    options: GenerateStructuredOptions<T>
  ): Promise<AIGatewayResult<z.infer<T>>> {
    const { task, systemPrompt, userPrompt, promptVersion, schema, userId, temperature, maxTokens, modelOverride } = options;
    const model = modelOverride || getModel(task);
    const startTime = Date.now();
    const config = getAIConfig();

    const formattedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond ONLY with valid JSON matching the requested schema. Do not enclose in markdown code blocks if possible.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: formattedSystemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await openRouterClient.complete({
        model,
        messages,
        temperature: temperature ?? config.temperature,
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
          task: String(task).toLowerCase(),
          provider: config.provider,
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
          task: String(task).toLowerCase(),
          provider: config.provider,
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
        task: String(task).toLowerCase(),
        provider: config.provider,
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
