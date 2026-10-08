import { createAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/observability/logger";
import { AICacheEntry, AICacheLookupResult, CacheScope } from "./types";

export class ExactCacheRepository {
  /**
   * Performs an exact L1 cache lookup by canonical SHA-256 key hash.
   * Enforces strict model matching, valid TTL, and cross-user isolation.
   */
  async lookup(params: {
    cacheKeyHash: string;
    requestedModel: string;
    requestedScope: CacheScope;
    userId?: string;
  }): Promise<AICacheLookupResult | null> {
    const startTime = Date.now();
    try {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from("ai_response_cache")
        .select("*")
        .eq("cache_key_hash", params.cacheKeyHash)
        .single();

      if (error || !data) {
        return null;
      }

      // 1. Expiration check
      const now = new Date();
      const expiresAt = new Date(data.expires_at);
      if (expiresAt <= now) {
        return null;
      }

      // 2. Strict model compatibility (§S7.8 Section 24)
      if (data.model !== params.requestedModel) {
        logger.debug("Exact cache miss due to strict model mismatch", {
          cachedModel: data.model,
          requestedModel: params.requestedModel,
        });
        return null;
      }

      // 3. User isolation check for contextual entries (§S7.8 Section 30)
      if (data.scope === "USER_CONTEXTUAL") {
        if (!params.userId || data.user_id !== params.userId) {
          logger.warn("Contextual cache access rejected due to user mismatch", {
            cachedUserId: data.user_id,
            requestedUserId: params.userId,
          });
          return null;
        }
      }

      // 4. Validation and quality verification
      if (data.validation_status !== "VALIDATED" || data.quality_status !== "PASSED") {
        return null;
      }

      const latencyMs = Date.now() - startTime;

      // Asynchronously update hit count and last_hit_at (fire-and-forget)
      this.incrementHitCount(data.id, data.hit_count || 0).catch((err) => {
        logger.warn("Failed to update cache hit count asynchronously", { error: String(err) });
      });

      return {
        hit: true,
        layer: "L1_EXACT",
        data: data.response_payload,
        rawText: typeof data.response_payload === "string" ? data.response_payload : JSON.stringify(data.response_payload),
        cacheKeyHash: data.cache_key_hash,
        cachedModel: data.model,
        latencyMs,
        recordId: data.id,
      };
    } catch (err: unknown) {
      logger.warn("Exact cache lookup encountered safe error", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Stores a validated AI completion in the exact cache.
   * Safe upsert handling prevents cache stampede race conditions.
   */
  async store(entry: AICacheEntry): Promise<boolean> {
    try {
      const supabase = createAdminClient();
      const { error } = await supabase.from("ai_response_cache").upsert(
        {
          cache_key_hash: entry.cacheKeyHash,
          task: entry.task,
          cache_type: entry.cacheType,
          scope: entry.scope,
          user_id: entry.scope === "USER_CONTEXTUAL" ? entry.userId || null : null,
          model: entry.model,
          model_version: entry.modelVersion || null,
          prompt_version: entry.promptVersion,
          schema_version: entry.schemaVersion,
          policy_version: entry.policyVersion,
          domain_id: entry.domainId || null,
          competency_id: entry.competencyId || null,
          normalized_input: entry.normalizedInput,
          context_fingerprint: entry.contextFingerprint || null,
          response_payload: entry.responsePayload,
          response_hash: entry.responseHash,
          embedding: entry.embedding ? JSON.stringify(entry.embedding) : null,
          validation_status: entry.validationStatus,
          quality_status: entry.qualityStatus,
          metadata: entry.metadata || {},
          expires_at: entry.expiresAt.toISOString(),
        },
        { onConflict: "cache_key_hash" }
      );

      if (error) {
        logger.warn("Failed to store entry in exact cache", { error: error.message });
        return false;
      }

      return true;
    } catch (err: unknown) {
      logger.warn("Exception during cache store", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  private async incrementHitCount(id: string, currentCount: number): Promise<void> {
    const supabase = createAdminClient();
    await supabase
      .from("ai_response_cache")
      .update({
        hit_count: currentCount + 1,
        last_hit_at: new Date().toISOString(),
      })
      .eq("id", id);
  }
}

export const exactCacheRepository = new ExactCacheRepository();
