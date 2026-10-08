import { createAdminClient } from "@/lib/db/supabase-admin";
import { logger } from "@/lib/observability/logger";
import { embeddingService } from "./embeddings";
import { AICacheLookupResult, CacheScope } from "./types";

export class SemanticCacheRepository {
  /**
   * Performs conservative L2 semantic vector search using Supabase pgvector.
   * Matches only when model, versions, policy, and scope are strictly identical.
   */
  async lookup(params: {
    text: string;
    task: string;
    model: string;
    promptVersion: string;
    schemaVersion: string;
    policyVersion: string;
    scope: CacheScope;
    similarityThreshold: number;
    userId?: string;
    domainId?: string;
    competencyId?: string;
  }): Promise<AICacheLookupResult | null> {
    const startTime = Date.now();

    // 1. Semantic cache V1 is restricted to SHARED requests (§S7.8 Section 12, 13)
    if (params.scope !== "SHARED") {
      return null;
    }

    try {
      // 2. Generate embedding for query text
      const queryEmbedding = await embeddingService.embed(params.text);
      if (!queryEmbedding) {
        return null;
      }

      // 3. Query pgvector through stored procedure
      const supabase = createAdminClient();
      const { data, error } = await supabase.rpc("match_ai_cache", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: params.similarityThreshold,
        match_count: 1,
        p_task: params.task.toLowerCase().trim(),
        p_model: params.model.trim(),
        p_prompt_version: params.promptVersion.trim(),
        p_schema_version: params.schemaVersion.trim(),
        p_policy_version: params.policyVersion.trim(),
        p_scope: params.scope,
        p_user_id: params.userId || null,
        p_domain_id: params.domainId || null,
        p_competency_id: params.competencyId || null,
      });

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return null;
      }

      const match = data[0];
      const similarity = Number(match.similarity || 0);

      // 4. Double check strict threshold
      if (similarity < params.similarityThreshold) {
        return null;
      }

      const latencyMs = Date.now() - startTime;

      // Update hit count asynchronously
      this.incrementHitCount(match.id, match.hit_count || 0).catch((err) => {
        logger.warn("Failed to update semantic cache hit count asynchronously", { error: String(err) });
      });

      return {
        hit: true,
        layer: "L2_SEMANTIC",
        data: match.response_payload,
        rawText: typeof match.response_payload === "string" ? match.response_payload : JSON.stringify(match.response_payload),
        cacheKeyHash: match.cache_key_hash,
        cachedModel: match.model,
        similarity,
        latencyMs,
        recordId: match.id,
      };
    } catch (err: unknown) {
      logger.warn("Semantic cache lookup failed safely (proceeding to LLM)", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
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

export const semanticCacheRepository = new SemanticCacheRepository();
