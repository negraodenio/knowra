import { describe, it, expect, beforeEach, vi } from "vitest";
import { canonicalizeRequest, deepSortKeys, hashResponsePayload, normalizeText } from "@/lib/ai/cache/canonicalize";
import { getTaskCachePolicy, CACHE_POLICY_VERSION, NON_CACHEABLE_ENTITIES } from "@/lib/ai/cache/policy";
import { aiCacheService } from "@/lib/ai/cache/service";
import { exactCacheRepository } from "@/lib/ai/cache/exact-cache";
import { semanticCacheRepository } from "@/lib/ai/cache/semantic-cache";
import { embeddingService } from "@/lib/ai/cache/embeddings";
import { aiGateway } from "@/lib/ai/gateway";
import { openRouterClient } from "@/lib/ai/openrouter";
import { telemetryService } from "@/lib/ai/usage";
import { aiModelOrchestrator } from "@/lib/ai/orchestrator";
import { z } from "zod";

describe("S7.8 — AI Cache & Supabase pgvector Suite (§S7.8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    telemetryService.clearUsageRecords();
  });

  // =========================================================================
  // 1. CANONICALIZATION & HASHING (Requirements 1-6)
  // =========================================================================
  describe("1. Canonicalization & Deterministic Hashing", () => {
    it("sorts nested object keys deterministically regardless of key order", () => {
      const obj1 = { b: 2, a: 1, c: { z: 26, y: 25 } };
      const obj2 = { a: 1, c: { y: 25, z: 26 }, b: 2 };

      expect(JSON.stringify(deepSortKeys(obj1))).toBe(JSON.stringify(deepSortKeys(obj2)));
    });

    it("produces identical SHA-256 hash for identical requests", () => {
      const req1 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "tutor_v1",
        schemaVersion: "v1",
        policyVersion: "EDUIA_POLICY_V2",
        normalizedInput: "What is a Python list?",
        scope: "SHARED",
      });

      const req2 = canonicalizeRequest({
        task: "TUTOR", // casing normalized
        model: "openai/gpt-6-astra",
        promptVersion: "tutor_v1",
        schemaVersion: "v1",
        policyVersion: "EDUIA_POLICY_V2",
        normalizedInput: "  What is a Python list?  \r\n", // whitespace normalized
        scope: "SHARED",
      });

      expect(req1.hash).toBe(req2.hash);
      expect(req1.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("produces different hash when task changes", () => {
      const h1 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      const h2 = canonicalizeRequest({
        task: "material",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      expect(h1).not.toBe(h2);
    });

    it("produces different hash when model changes", () => {
      const h1 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      const h2 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-4o-mini",
        promptVersion: "v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      expect(h1).not.toBe(h2);
    });

    it("produces different hash when promptVersion changes", () => {
      const h1 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "tutor_v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      const h2 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "tutor_v2",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      expect(h1).not.toBe(h2);
    });

    it("produces different hash when schemaVersion changes", () => {
      const h1 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        schemaVersion: "v1",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      const h2 = canonicalizeRequest({
        task: "tutor",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        schemaVersion: "v2",
        policyVersion: "v2",
        normalizedInput: "Explain loops",
        scope: "SHARED",
      }).hash;

      expect(h1).not.toBe(h2);
    });
  });

  // =========================================================================
  // 2. CACHE POLICY & STATE ISOLATION (Requirements 21-27, 33-35)
  // =========================================================================
  describe("2. Cache Policy & State Invariants", () => {
    it("guarantees learning state and mastery entities are NEVER cacheable", () => {
      for (const entity of NON_CACHEABLE_ENTITIES) {
        const policy = getTaskCachePolicy(entity);
        expect(policy.enabled).toBe(false);
        expect(policy.allowExact).toBe(false);
        expect(policy.allowSemantic).toBe(false);
        expect(policy.scope).toBe("DISABLED");
      }
    });

    it("disables caching for sensitive / dynamically computed tasks (Feynman, Plan, Assessment)", () => {
      expect(getTaskCachePolicy("feynman").enabled).toBe(false);
      expect(getTaskCachePolicy("plan").enabled).toBe(false);
      expect(getTaskCachePolicy("assessment").enabled).toBe(false);
    });

    it("enforces conservative TTL on reusable tasks", () => {
      const tutorPolicy = getTaskCachePolicy("tutor");
      expect(tutorPolicy.enabled).toBe(true);
      expect(tutorPolicy.ttlSeconds).toBe(30 * 24 * 3600); // 30 days
      expect(tutorPolicy.allowExact).toBe(true);
      expect(tutorPolicy.allowSemantic).toBe(true);

      const classifierPolicy = getTaskCachePolicy("classifier");
      expect(classifierPolicy.enabled).toBe(true);
      expect(classifierPolicy.ttlSeconds).toBe(7 * 24 * 3600); // 7 days
      expect(classifierPolicy.allowSemantic).toBe(false); // Exact only
    });

    it("enforces strict user isolation for contextual cache entries", async () => {
      const lookupSpy = vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce(null);

      const result = await aiCacheService.lookup({
        task: "diagnostic",
        model: "openai/gpt-6-astra",
        promptVersion: "v1",
        input: "diagnostic query",
        userId: "user-alpha",
        scopeOverride: "USER_CONTEXTUAL",
      });

      expect(result.hit).toBe(false);
      expect(lookupSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          requestedScope: "USER_CONTEXTUAL",
          userId: "user-alpha",
        })
      );
    });
  });

  // =========================================================================
  // 3. EXACT & SEMANTIC CACHE LOOKUP (Requirements 7-15, 28, 29)
  // =========================================================================
  describe("3. Cache Execution & Model Compatibility", () => {
    it("exact cache hit avoids LLM call and returns validated response", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce({
        hit: true,
        layer: "L1_EXACT",
        data: "Cached explanation of Python lists",
        rawText: "Cached explanation of Python lists",
        cacheKeyHash: "mocked-hash-123",
        cachedModel: "openai/gpt-6-astra",
        latencyMs: 5,
      });

      const openRouterSpy = vi.spyOn(openRouterClient, "complete");

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "What is a Python list?",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      expect(result.data).toBe("Cached explanation of Python lists");
      expect(openRouterSpy).not.toHaveBeenCalled(); // LLM CALL AVOIDED!
      expect(result.usage.cacheHit).toBe(true);
      expect(result.usage.cacheLayer).toBe("L1_EXACT");
      expect(result.usage.llmCallsAvoided).toBe(1);
      expect(result.usage.estimatedCostSaved).toBeGreaterThan(0);
    });

    it("exact cache miss calls Orchestrator and invokes primary model (Astra)", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce(null);
      vi.spyOn(semanticCacheRepository, "lookup").mockResolvedValueOnce(null);

      const openRouterSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "A Python list is a mutable sequence.",
        model: "openai/gpt-6-astra",
        promptTokens: 150,
        completionTokens: 80,
      });

      const storeSpy = vi.spyOn(aiCacheService, "store").mockResolvedValueOnce(true);

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "What is a Python list?",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      expect(result.data).toBe("A Python list is a mutable sequence.");
      expect(openRouterSpy).toHaveBeenCalledTimes(1);
      expect(result.usage.cacheHit).toBe(false);
      expect(result.usage.actualLlmCall).toBe(true);
      expect(storeSpy).toHaveBeenCalled();
    });

    it("semantic hit avoids LLM call when similarity exceeds threshold", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce(null); // exact miss
      vi.spyOn(semanticCacheRepository, "lookup").mockResolvedValueOnce({
        hit: true,
        layer: "L2_SEMANTIC",
        data: "Semantic cached explanation",
        rawText: "Semantic cached explanation",
        cacheKeyHash: "semantic-hash-456",
        cachedModel: "openai/gpt-6-astra",
        similarity: 0.96,
        latencyMs: 15,
      });

      const openRouterSpy = vi.spyOn(openRouterClient, "complete");

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "Explain Python list structures",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      expect(result.data).toBe("Semantic cached explanation");
      expect(openRouterSpy).not.toHaveBeenCalled(); // LLM avoided!
      expect(result.usage.cacheHit).toBe(true);
      expect(result.usage.cacheLayer).toBe("L2_SEMANTIC");
      expect(result.usage.semanticSimilarity).toBe(0.96);
    });

    it("strict model compatibility: cache entry for a different model MUST NOT hit", async () => {
      // Simulate exact repo rejecting because model mismatch (§S7.8 Section 24)
      vi.spyOn(exactCacheRepository, "lookup").mockImplementationOnce(async ({ requestedModel }) => {
        // Cached entry was created by gpt-4o-mini, but caller asked for gpt-6-astra
        const cachedModel = "openai/gpt-4o-mini";
        if (cachedModel !== requestedModel) {
          return null; // Strict model miss!
        }
        return {
          hit: true,
          layer: "L1_EXACT",
          data: "Mini content",
          cachedModel,
          latencyMs: 2,
        };
      });

      const lookup = await aiCacheService.lookup({
        task: "tutor",
        model: "openai/gpt-6-astra", // Requested Astra
        promptVersion: "v1",
        input: "Explain recursion",
      });

      expect(lookup.hit).toBe(false); // Cache must miss so Astra is called!
    });
  });

  // =========================================================================
  // 4. RESILIENCE & FAILURE SAFETY (Requirements 16-20, 28, 29)
  // =========================================================================
  describe("4. Resilience & Error Handling", () => {
    it("database error during cache lookup does NOT break AI execution", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockRejectedValueOnce(
        new Error("Connection to Supabase timed out")
      );

      const openRouterSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Resilient answer from Astra",
        model: "openai/gpt-6-astra",
        promptTokens: 100,
        completionTokens: 50,
      });

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "Help with syntax",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      expect(result.data).toBe("Resilient answer from Astra");
      expect(openRouterSpy).toHaveBeenCalledTimes(1);
    });

    it("embedding service failure does NOT break AI execution", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce(null);
      vi.spyOn(embeddingService, "embed").mockResolvedValueOnce(null); // embedding fails safely

      const openRouterSpy = vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: "Safe fallback answer",
        model: "openai/gpt-6-astra",
        promptTokens: 100,
        completionTokens: 50,
      });

      const result = await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "Help with lists",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      expect(result.data).toBe("Safe fallback answer");
      expect(openRouterSpy).toHaveBeenCalledTimes(1);
    });

    it("Zod schema validation failure is NEVER stored in cache", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce(null);
      vi.spyOn(semanticCacheRepository, "lookup").mockResolvedValueOnce(null);

      // LLM returns invalid JSON/schema
      vi.spyOn(openRouterClient, "complete").mockResolvedValueOnce({
        content: JSON.stringify({ wrongField: 123 }),
        model: "openai/gpt-6-astra",
        promptTokens: 100,
        completionTokens: 50,
      });

      const storeSpy = vi.spyOn(aiCacheService, "store");

      const testSchema = z.object({
        correctField: z.string(),
      });

      await expect(
        aiGateway.generateStructured({
          task: "tutor",
          systemPrompt: "Respond with json",
          userPrompt: "Test schema",
          promptVersion: "v1",
          schema: testSchema,
          modelOverride: "openai/gpt-6-astra",
        })
      ).rejects.toThrow("AI output failed schema validation");

      expect(storeSpy).not.toHaveBeenCalled(); // Invalid response NEVER cached!
    });
  });

  // =========================================================================
  // 5. TELEMETRY & COST ACCOUNTING (Requirements 30-32)
  // =========================================================================
  describe("5. Telemetry & Cost Accounting", () => {
    it("records full observability on cache hit including cost saved and avoided calls", async () => {
      vi.spyOn(exactCacheRepository, "lookup").mockResolvedValueOnce({
        hit: true,
        layer: "L1_EXACT",
        data: "Validated cached tutor reply",
        rawText: "Validated cached tutor reply",
        cacheKeyHash: "sha256-hash-xyz",
        cachedModel: "openai/gpt-6-astra",
        latencyMs: 12,
      });

      await aiGateway.generateText({
        task: "tutor",
        systemPrompt: "You are a tutor",
        userPrompt: "Explain dictionary keys",
        promptVersion: "tutor_v1",
        modelOverride: "openai/gpt-6-astra",
      });

      const records = telemetryService.getUsageRecords("tutor");
      expect(records.length).toBe(1);
      const record = records[0];

      expect(record.cacheHit).toBe(true);
      expect(record.cacheLayer).toBe("L1_EXACT");
      expect(record.actualLlmCall).toBe(false);
      expect(record.llmCallsAvoided).toBe(1);
      expect(record.estimatedCostSaved).toBeGreaterThan(0);
      expect(record.promptTokens).toBe(0);
      expect(record.completionTokens).toBe(0);

      const stats = telemetryService.getModelObservabilityStats();
      const astraStats = stats["openai/gpt-6-astra:tutor"];
      expect(astraStats).toBeDefined();
      expect(astraStats.cacheHitCount).toBe(1);
      expect(astraStats.llmCallsAvoided).toBe(1);
      expect(astraStats.estimatedCostSaved).toBeGreaterThan(0);
    });
  });
});
