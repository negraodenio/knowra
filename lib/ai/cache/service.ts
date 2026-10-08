import { logger } from "@/lib/observability/logger";
import { KNOWN_MODEL_PRICING } from "@/lib/ai/models";
import { canonicalizeRequest, hashResponsePayload, normalizeText } from "./canonicalize";
import { getTaskCachePolicy, CACHE_POLICY_VERSION } from "./policy";
import { exactCacheRepository } from "./exact-cache";
import { semanticCacheRepository } from "./semantic-cache";
import { embeddingService } from "./embeddings";
import {
  AICacheEntry,
  AICacheLookupResult,
  AICachePolicy,
  CacheScope,
} from "./types";

export interface CacheLookupParams {
  task: string;
  model: string;
  modelVersion?: string;
  promptVersion: string;
  schemaVersion?: string;
  policyVersion?: string;
  input: string;
  domainId?: string;
  competencyId?: string;
  contextFingerprint?: string;
  userId?: string;
  scopeOverride?: CacheScope;
}

export interface CacheStoreParams {
  task: string;
  model: string;
  modelVersion?: string;
  promptVersion: string;
  schemaVersion?: string;
  policyVersion?: string;
  input: string;
  domainId?: string;
  competencyId?: string;
  contextFingerprint?: string;
  userId?: string;
  scopeOverride?: CacheScope;
  responsePayload: unknown;
  rawText?: string;
  metadata?: Record<string, unknown>;
  promptTokens?: number;
  completionTokens?: number;
}

export class AICacheService {
  /**
   * Feature flag to enable or disable AI cache globally.
   * Default: true unless explicitly set to 'false'.
   */
  public isCacheEnabled(): boolean {
    return process.env.ENABLE_AI_CACHE !== "false";
  }

  /**
   * Resolves the active cache policy for a task.
   */
  public getPolicy(task: string, scopeOverride?: CacheScope): AICachePolicy {
    return getTaskCachePolicy(task, scopeOverride);
  }

  /**
   * Performs an L1 (Exact) and L2 (Semantic) cache lookup.
   * Fails safe on database or network errors by returning a miss.
   */
  async lookup<T = unknown>(params: CacheLookupParams): Promise<AICacheLookupResult<T>> {
    const startTime = Date.now();

    if (!this.isCacheEnabled()) {
      return { hit: false, layer: "NONE", latencyMs: 0 };
    }

    const policy = this.getPolicy(params.task, params.scopeOverride);
    if (!policy.enabled || policy.scope === "DISABLED") {
      return { hit: false, layer: "NONE", latencyMs: 0 };
    }

    const effectivePolicyVersion = params.policyVersion || CACHE_POLICY_VERSION;
    const effectiveSchemaVersion = params.schemaVersion || "v1";

    try {
      // 1. Canonicalize Request & Generate Key Hash
      const { hash: cacheKeyHash } = canonicalizeRequest({
        task: params.task,
        model: params.model,
        modelVersion: params.modelVersion,
        promptVersion: params.promptVersion,
        schemaVersion: effectiveSchemaVersion,
        policyVersion: effectivePolicyVersion,
        normalizedInput: params.input,
        domainId: params.domainId,
        competencyId: params.competencyId,
        contextFingerprint: params.contextFingerprint,
        userId: params.userId,
        scope: policy.scope,
      });

      // 2. L1 Exact Cache Lookup (§S7.8 Section 9)
      if (policy.allowExact) {
        const exactResult = await exactCacheRepository.lookup({
          cacheKeyHash,
          requestedModel: params.model,
          requestedScope: policy.scope,
          userId: params.userId,
        });

        if (exactResult && exactResult.hit) {
          const estimatedCostSaved = this.calculateEstimatedCostSaved(
            params.model,
            300, // conservative estimated prompt tokens
            250  // conservative estimated completion tokens
          );

          return {
            hit: true,
            layer: "L1_EXACT",
            data: exactResult.data as T,
            rawText: exactResult.rawText,
            cacheKeyHash,
            cachedModel: exactResult.cachedModel,
            latencyMs: Date.now() - startTime,
            recordId: exactResult.recordId,
            estimatedCostSaved,
          };
        }
      }

      // 3. L2 Semantic Cache Lookup (§S7.8 Section 11, 12)
      if (policy.allowSemantic && policy.scope === "SHARED") {
        const semanticResult = await semanticCacheRepository.lookup({
          text: params.input,
          task: params.task,
          model: params.model,
          promptVersion: params.promptVersion,
          schemaVersion: effectiveSchemaVersion,
          policyVersion: effectivePolicyVersion,
          scope: policy.scope,
          similarityThreshold: policy.semanticSimilarityThreshold,
          userId: params.userId,
          domainId: params.domainId,
          competencyId: params.competencyId,
        });

        if (semanticResult && semanticResult.hit) {
          const estimatedCostSaved = this.calculateEstimatedCostSaved(
            params.model,
            300,
            250
          );

          return {
            hit: true,
            layer: "L2_SEMANTIC",
            data: semanticResult.data as T,
            rawText: semanticResult.rawText,
            cacheKeyHash: semanticResult.cacheKeyHash,
            cachedModel: semanticResult.cachedModel,
            similarity: semanticResult.similarity,
            latencyMs: Date.now() - startTime,
            recordId: semanticResult.recordId,
            estimatedCostSaved,
          };
        }
      }

      // 4. Cache Miss
      return {
        hit: false,
        layer: "NONE",
        cacheKeyHash,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      logger.warn("AI Cache lookup failed safely (proceeding to LLM)", {
        task: params.task,
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        hit: false,
        layer: "NONE",
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Stores a validated response in the cache.
   * NEVER called on validation or infrastructure failures (§S7.8 Section 26).
   */
  async store(params: CacheStoreParams): Promise<boolean> {
    if (!this.isCacheEnabled()) {
      return false;
    }

    const policy = this.getPolicy(params.task, params.scopeOverride);
    if (!policy.enabled || policy.scope === "DISABLED") {
      return false;
    }

    const effectivePolicyVersion = params.policyVersion || CACHE_POLICY_VERSION;
    const effectiveSchemaVersion = params.schemaVersion || "v1";

    try {
      const { hash: cacheKeyHash } = canonicalizeRequest({
        task: params.task,
        model: params.model,
        modelVersion: params.modelVersion,
        promptVersion: params.promptVersion,
        schemaVersion: effectiveSchemaVersion,
        policyVersion: effectivePolicyVersion,
        normalizedInput: params.input,
        domainId: params.domainId,
        competencyId: params.competencyId,
        contextFingerprint: params.contextFingerprint,
        userId: params.userId,
        scope: policy.scope,
      });

      const responseHash = hashResponsePayload(params.responsePayload);
      const expiresAt = new Date(Date.now() + policy.ttlSeconds * 1000);

      // Generate embedding if semantic cache is supported for this task and scope
      let embedding: number[] | undefined;
      if (policy.allowSemantic && policy.scope === "SHARED") {
        const vec = await embeddingService.embed(params.input);
        if (vec) {
          embedding = vec;
        }
      }

      const entry: AICacheEntry = {
        cacheKeyHash,
        task: params.task.toLowerCase().trim(),
        cacheType: embedding ? "SEMANTIC" : "EXACT",
        scope: policy.scope,
        userId: policy.scope === "USER_CONTEXTUAL" ? params.userId : undefined,
        model: params.model.trim(),
        modelVersion: params.modelVersion,
        promptVersion: params.promptVersion.trim(),
        schemaVersion: effectiveSchemaVersion,
        policyVersion: effectivePolicyVersion,
        domainId: params.domainId,
        competencyId: params.competencyId,
        normalizedInput: normalizeText(params.input),
        contextFingerprint: params.contextFingerprint,
        responsePayload: params.responsePayload,
        responseHash,
        embedding,
        validationStatus: "VALIDATED",
        qualityStatus: "PASSED",
        metadata: {
          ...params.metadata,
          storedAt: new Date().toISOString(),
          promptTokens: params.promptTokens || 0,
          completionTokens: params.completionTokens || 0,
        },
        expiresAt,
      };

      return await exactCacheRepository.store(entry);
    } catch (err: unknown) {
      logger.warn("AI Cache store failed safely", {
        task: params.task,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Calculates the estimated cost of an avoided LLM call based on model pricing (§S7.8 Section 32).
   */
  public calculateEstimatedCostSaved(
    model: string,
    promptTokens = 300,
    completionTokens = 250
  ): number {
    const pricing = KNOWN_MODEL_PRICING[model] || {
      promptTokenPricePerMillion: 10.0,      // Astra baseline
      completionTokenPricePerMillion: 50.0,
    };

    const promptCost = (promptTokens / 1_000_000) * pricing.promptTokenPricePerMillion;
    const completionCost = (completionTokens / 1_000_000) * pricing.completionTokenPricePerMillion;

    return Number((promptCost + completionCost).toFixed(6));
  }
}

export const aiCacheService = new AICacheService();
