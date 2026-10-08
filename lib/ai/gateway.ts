import { z } from "zod";
import { openRouterClient, OpenRouterMessage } from "./openrouter";
import { ModelTask, AITask } from "./models";
import { telemetryService, AIUsageRecord } from "./usage";
import { logger } from "@/lib/observability/logger";
import { getAIConfig } from "./config";
import { aiModelOrchestrator, RequirementLevel } from "./orchestrator";
import { aiCacheService } from "./cache";

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
  bypassCache?: boolean;

  // S7.5 Context Parameters
  domain?: string;
  difficulty?: number;
  latencyRequirement?: RequirementLevel;
  qualityRequirement?: RequirementLevel;
  costSensitivity?: RequirementLevel;
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
      domain: options?.domain,
      difficulty: options?.difficulty,
      latencyRequirement: options?.latencyRequirement,
      qualityRequirement: options?.qualityRequirement,
      costSensitivity: options?.costSensitivity,
    });
  }

  /**
   * Generates a raw text completion through the OpenRouter gateway.
   * Model selection is determined by the AI Model Orchestrator (§S7.5).
   * Supports operational fallback on network/timeout/5xx/404 failures.
   */
  async generateText(options: GenerateTextOptions): Promise<AIGatewayResult<string>> {
    const { task, systemPrompt, userPrompt, promptVersion, userId, temperature, maxTokens, modelOverride } = options;
    const startTime = Date.now();
    const config = getAIConfig();

    // 1. Orchestrator model selection
    const decision = aiModelOrchestrator.selectModel({
      task,
      domain: options.domain,
      difficulty: options.difficulty,
      latencyRequirement: options.latencyRequirement,
      qualityRequirement: options.qualityRequirement,
      costSensitivity: options.costSensitivity,
    });
    const model = modelOverride || decision.model;

    // 2. AI Cache Lookup (L1 Exact -> L2 Semantic) (§S7.8 Section 7)
    if (!options.bypassCache) {
      const cacheResult = await aiCacheService.lookup<string>({
        task: String(task).toLowerCase(),
        model,
        promptVersion,
        policyVersion: decision.policyVersion,
        input: userPrompt,
        domainId: options.domain,
        userId,
        scopeOverride: options.userId ? undefined : "SHARED",
      });

      if (cacheResult.hit && cacheResult.data) {
        const usage = await telemetryService.recordUsage({
          userId,
          operation: `generateText:${task}`,
          task: String(task).toLowerCase(),
          provider: config.provider,
          model: cacheResult.cachedModel || model,
          selectedModel: model,
          primaryModel: decision.primaryModel,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs: cacheResult.latencyMs,
          status: "SUCCESS",
          orchestrationPolicy: decision.policyVersion,
          selectionReason: decision.reason,
          fallbackUsed: false,
          cacheEnabled: true,
          cacheType: cacheResult.layer === "L2_SEMANTIC" ? "SEMANTIC" : "EXACT",
          cacheLayer: cacheResult.layer,
          cacheHit: true,
          cacheKeyHash: cacheResult.cacheKeyHash,
          semanticSimilarity: cacheResult.similarity,
          cacheLatencyMs: cacheResult.latencyMs,
          estimatedCostSaved: cacheResult.estimatedCostSaved,
          actualLlmCall: false,
          llmCallsAvoided: 1,
        });

        return {
          data: cacheResult.data,
          rawText: cacheResult.rawText || cacheResult.data,
          usage,
          model: cacheResult.cachedModel || model,
          promptVersion,
        };
      }
    }

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

      // Asynchronously store validated response in cache (§S7.8 Section 7, 26)
      if (!options.bypassCache) {
        aiCacheService.store({
          task: String(task).toLowerCase(),
          model: response.model,
          promptVersion,
          policyVersion: decision.policyVersion,
          input: userPrompt,
          domainId: options.domain,
          userId,
          scopeOverride: options.userId ? undefined : "SHARED",
          responsePayload: response.content,
          rawText: response.content,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
        }).catch((err) => logger.warn("AI Cache store async failure", { error: String(err) }));
      }

      const latencyMs = Date.now() - startTime;
      const usage = await telemetryService.recordUsage({
        userId,
        operation: `generateText:${task}`,
        task: String(task).toLowerCase(),
        provider: config.provider,
        model: response.model,
        selectedModel: model,
        primaryModel: decision.primaryModel,
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        latencyMs,
        status: "SUCCESS",
        orchestrationPolicy: decision.policyVersion,
        selectionReason: decision.reason,
        fallbackUsed: false,
        cacheEnabled: true,
        cacheLayer: "NONE",
        cacheHit: false,
        actualLlmCall: true,
      });

      return {
        data: response.content,
        rawText: response.content,
        usage,
        model: response.model,
        promptVersion,
      };
    } catch (err: unknown) {
      // 2. Operational Fallback Attempt (§S7.5)
      if (!modelOverride && decision.fallbackModel && decision.fallbackModel !== model && aiModelOrchestrator.isOperationalError(err)) {
        logger.warn(`AI Gateway: Operational failure on primary model ${model}. Attempting fallback to ${decision.fallbackModel}...`, {
          task,
          primaryModel: model,
          fallbackModel: decision.fallbackModel,
          error: err instanceof Error ? err.message : String(err),
        });

        try {
          const fallbackResponse = await openRouterClient.complete({
            model: decision.fallbackModel,
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
            model: fallbackResponse.model,
            primaryModel: decision.primaryModel,
            promptTokens: fallbackResponse.promptTokens,
            completionTokens: fallbackResponse.completionTokens,
            latencyMs,
            status: "SUCCESS",
            orchestrationPolicy: decision.policyVersion,
            selectionReason: decision.reason,
            fallbackUsed: true,
            fallbackModel: decision.fallbackModel,
            fallbackReason: err instanceof Error ? err.message : String(err),
          });

          return {
            data: fallbackResponse.content,
            rawText: fallbackResponse.content,
            usage,
            model: fallbackResponse.model,
            promptVersion,
          };
        } catch (fallbackErr: unknown) {
          logger.error(`AI Gateway: Fallback model ${decision.fallbackModel} also failed`, fallbackErr);
        }
      }

      const latencyMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      await telemetryService.recordUsage({
        userId,
        operation: `generateText:${task}`,
        task: String(task).toLowerCase(),
        provider: config.provider,
        model,
        primaryModel: decision.primaryModel,
        promptTokens: 0,
        completionTokens: 0,
        latencyMs,
        status: "FAILED",
        errorMessage,
        orchestrationPolicy: decision.policyVersion,
        selectionReason: decision.reason,
      });

      logger.error(`AI Gateway generation failed for task ${task}`, err, { task, model, promptVersion });
      throw err;
    }
  }

  /**
   * Generates a structured output validated strictly against a Zod schema (§32, §S7.5).
   * Model selection is determined by the AI Model Orchestrator.
   * Strips markdown fences if present and validates against Zod schema.
   * Operational fallback applies only to infrastructure/network failures, NOT validation errors.
   */
  async generateStructured<T extends z.ZodTypeAny>(
    options: GenerateStructuredOptions<T>
  ): Promise<AIGatewayResult<z.infer<T>>> {
    const { task, systemPrompt, userPrompt, promptVersion, schema, userId, temperature, maxTokens, modelOverride } = options;
    const startTime = Date.now();
    const config = getAIConfig();

    // 1. Orchestrator model selection
    const decision = aiModelOrchestrator.selectModel({
      task,
      domain: options.domain,
      difficulty: options.difficulty,
      latencyRequirement: options.latencyRequirement,
      qualityRequirement: options.qualityRequirement,
      costSensitivity: options.costSensitivity,
    });
    const model = modelOverride || decision.model;

    // 2. AI Cache Lookup (L1 Exact -> L2 Semantic) (§S7.8 Section 7)
    if (!options.bypassCache) {
      const cacheResult = await aiCacheService.lookup<z.infer<T>>({
        task: String(task).toLowerCase(),
        model,
        promptVersion,
        policyVersion: decision.policyVersion,
        input: userPrompt,
        domainId: options.domain,
        userId,
        scopeOverride: options.userId ? undefined : "SHARED",
      });

      if (cacheResult.hit && cacheResult.data) {
        const validatedCache = schema.safeParse(cacheResult.data);
        if (validatedCache.success) {
          const usage = await telemetryService.recordUsage({
            userId,
            operation: `generateStructured:${task}`,
            task: String(task).toLowerCase(),
            provider: config.provider,
            model: cacheResult.cachedModel || model,
            selectedModel: model,
            primaryModel: decision.primaryModel,
            promptTokens: 0,
            completionTokens: 0,
            latencyMs: cacheResult.latencyMs,
            status: "SUCCESS",
            orchestrationPolicy: decision.policyVersion,
            selectionReason: decision.reason,
            fallbackUsed: false,
            cacheEnabled: true,
            cacheType: cacheResult.layer === "L2_SEMANTIC" ? "SEMANTIC" : "EXACT",
            cacheLayer: cacheResult.layer,
            cacheHit: true,
            cacheKeyHash: cacheResult.cacheKeyHash,
            semanticSimilarity: cacheResult.similarity,
            cacheLatencyMs: cacheResult.latencyMs,
            estimatedCostSaved: cacheResult.estimatedCostSaved,
            actualLlmCall: false,
            llmCallsAvoided: 1,
          });

          return {
            data: validatedCache.data,
            rawText: cacheResult.rawText || JSON.stringify(cacheResult.data),
            usage,
            model: cacheResult.cachedModel || model,
            promptVersion,
          };
        }
      }
    }

    const formattedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: You MUST respond ONLY with valid JSON matching the requested schema. Do not enclose in markdown code blocks if possible.`;

    const messages: OpenRouterMessage[] = [
      { role: "system", content: formattedSystemPrompt },
      { role: "user", content: userPrompt },
    ];

    let responseContent: string;
    let responseModel: string;
    let responsePromptTokens: number;
    let responseCompletionTokens: number;
    let wasFallbackUsed = false;

    try {
      const response = await openRouterClient.complete({
        model,
        messages,
        temperature: temperature ?? config.temperature,
        maxTokens,
        responseFormat: { type: "json_object" },
      });

      responseContent = response.content;
      responseModel = response.model;
      responsePromptTokens = response.promptTokens;
      responseCompletionTokens = response.completionTokens;
    } catch (operationalErr: unknown) {
      // 2. Operational Fallback Attempt for infrastructure errors
      if (!modelOverride && decision.fallbackModel && decision.fallbackModel !== model && aiModelOrchestrator.isOperationalError(operationalErr)) {
        logger.warn(`AI Gateway structured: Operational failure on model ${model}. Attempting fallback to ${decision.fallbackModel}...`, {
          task,
          primaryModel: model,
          fallbackModel: decision.fallbackModel,
          error: operationalErr instanceof Error ? operationalErr.message : String(operationalErr),
        });

        try {
          const fallbackResp = await openRouterClient.complete({
            model: decision.fallbackModel,
            messages,
            temperature: temperature ?? config.temperature,
            maxTokens,
            responseFormat: { type: "json_object" },
          });

          responseContent = fallbackResp.content;
          responseModel = fallbackResp.model;
          responsePromptTokens = fallbackResp.promptTokens;
          responseCompletionTokens = fallbackResp.completionTokens;
          wasFallbackUsed = true;
        } catch (fallbackErr: unknown) {
          const latencyMs = Date.now() - startTime;
          const errorMessage = operationalErr instanceof Error ? operationalErr.message : String(operationalErr);
          await telemetryService.recordUsage({
            userId,
            operation: `generateStructured:${task}`,
            task: String(task).toLowerCase(),
            provider: config.provider,
            model,
            primaryModel: decision.primaryModel,
            promptTokens: 0,
            completionTokens: 0,
            latencyMs,
            status: "FAILED",
            errorMessage,
            orchestrationPolicy: decision.policyVersion,
            selectionReason: decision.reason,
          });
          logger.error(`AI Gateway structured: Fallback model ${decision.fallbackModel} also failed`, fallbackErr);
          throw operationalErr;
        }
      } else {
        const latencyMs = Date.now() - startTime;
        const errorMessage = operationalErr instanceof Error ? operationalErr.message : String(operationalErr);
        await telemetryService.recordUsage({
          userId,
          operation: `generateStructured:${task}`,
          task: String(task).toLowerCase(),
          provider: config.provider,
          model,
          primaryModel: decision.primaryModel,
          promptTokens: 0,
          completionTokens: 0,
          latencyMs,
          status: "FAILED",
          errorMessage,
          orchestrationPolicy: decision.policyVersion,
          selectionReason: decision.reason,
        });
        throw operationalErr;
      }
    }

    // 3. Schema Parsing & Validation (NO FALLBACK on parse or schema errors)
    const latencyMs = Date.now() - startTime;
    let cleanedContent = responseContent.trim();

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
        model: responseModel,
        primaryModel: decision.primaryModel,
        promptTokens: responsePromptTokens,
        completionTokens: responseCompletionTokens,
        latencyMs,
        status: "SCHEMA_ERROR",
        errorMessage: `JSON parse failed: ${String(jsonErr)}`,
        orchestrationPolicy: decision.policyVersion,
        selectionReason: decision.reason,
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
        model: responseModel,
        primaryModel: decision.primaryModel,
        promptTokens: responsePromptTokens,
        completionTokens: responseCompletionTokens,
        latencyMs,
        status: "SCHEMA_ERROR",
        errorMessage: `Zod validation error: ${parseResult.error.message}`,
        orchestrationPolicy: decision.policyVersion,
        selectionReason: decision.reason,
      });
      throw new Error(`AI output failed schema validation: ${parseResult.error.message}`);
    }

    // Asynchronously store validated response in cache (§S7.8 Section 7, 26)
    if (!options.bypassCache) {
      aiCacheService.store({
        task: String(task).toLowerCase(),
        model: responseModel,
        promptVersion,
        policyVersion: decision.policyVersion,
        input: userPrompt,
        domainId: options.domain,
        userId,
        scopeOverride: options.userId ? undefined : "SHARED",
        responsePayload: parseResult.data,
        rawText: responseContent,
        promptTokens: responsePromptTokens,
        completionTokens: responseCompletionTokens,
      }).catch((err) => logger.warn("AI Cache structured store async failure", { error: String(err) }));
    }

    const usage = await telemetryService.recordUsage({
      userId,
      operation: `generateStructured:${task}`,
      task: String(task).toLowerCase(),
      provider: config.provider,
      model: responseModel,
      selectedModel: model,
      primaryModel: decision.primaryModel,
      promptTokens: responsePromptTokens,
      completionTokens: responseCompletionTokens,
      latencyMs,
      status: "SUCCESS",
      orchestrationPolicy: decision.policyVersion,
      selectionReason: decision.reason,
      fallbackUsed: wasFallbackUsed,
      fallbackModel: wasFallbackUsed ? decision.fallbackModel : undefined,
      cacheEnabled: true,
      cacheLayer: "NONE",
      cacheHit: false,
      actualLlmCall: true,
    });

    return {
      data: parseResult.data,
      rawText: responseContent,
      usage,
      model: responseModel,
      promptVersion,
    };
  }
}

export const aiGateway = new AIGateway();
