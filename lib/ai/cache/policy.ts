import { AICachePolicy, CacheScope } from "./types";

export const CACHE_POLICY_VERSION = "CACHE_POLICY_V1";

/**
 * Task-specific AI cache policy definitions (§S7.8 Section 23).
 * Conservative V1 policy favoring pedagogical correctness over maximal hit rate.
 */
export const TASK_CACHE_POLICIES: Record<string, AICachePolicy> = {
  // Tutor: Shared conceptual explanations can be exact or semantically reused
  tutor: {
    enabled: true,
    allowExact: true,
    allowSemantic: true,
    scope: "SHARED",
    ttlSeconds: 30 * 24 * 3600, // 30 days
    semanticSimilarityThreshold: 0.92,
  },

  // Material: Static curriculum explanations can be shared
  material: {
    enabled: true,
    allowExact: true,
    allowSemantic: true,
    scope: "SHARED",
    ttlSeconds: 14 * 24 * 3600, // 14 days
    semanticSimilarityThreshold: 0.92,
  },

  // Classifier: High-frequency intent detection can be exact cached
  classifier: {
    enabled: true,
    allowExact: true,
    allowSemantic: false,
    scope: "SHARED",
    ttlSeconds: 7 * 24 * 3600, // 7 days
    semanticSimilarityThreshold: 0.95,
  },

  // Diagnostic: Contextual assessment item selection (only exact, user-scoped)
  diagnostic: {
    enabled: true,
    allowExact: true,
    allowSemantic: false,
    scope: "USER_CONTEXTUAL",
    ttlSeconds: 1 * 24 * 3600, // 24 hours
    semanticSimilarityThreshold: 0.98,
  },

  // Competency: Formal definitions are reusable
  competency: {
    enabled: true,
    allowExact: true,
    allowSemantic: false,
    scope: "SHARED",
    ttlSeconds: 30 * 24 * 3600, // 30 days
    semanticSimilarityThreshold: 0.95,
  },

  // Feynman: Freeform learner explanations are highly distinct — cache DISABLED
  feynman: {
    enabled: false,
    allowExact: false,
    allowSemantic: false,
    scope: "DISABLED",
    ttlSeconds: 0,
    semanticSimilarityThreshold: 1.0,
  },

  // Assessment: Generated items must be fresh to avoid assessment compromise — cache DISABLED
  assessment: {
    enabled: false,
    allowExact: false,
    allowSemantic: false,
    scope: "DISABLED",
    ttlSeconds: 0,
    semanticSimilarityThreshold: 1.0,
  },

  // Plan: Learning plans depend directly on dynamic DAG gaps — cache DISABLED
  plan: {
    enabled: false,
    allowExact: false,
    allowSemantic: false,
    scope: "DISABLED",
    ttlSeconds: 0,
    semanticSimilarityThreshold: 1.0,
  },
};

/**
 * Non-AI entities that must NEVER be cached as AI responses (§S7.8 Section 14).
 * Their single source of truth is PostgreSQL database state.
 */
export const NON_CACHEABLE_ENTITIES = new Set([
  "learning_state",
  "mastery",
  "confidence",
  "gaps",
  "recommendations",
  "next_best_action",
  "evidence",
  "retention",
  "learning_gain",
]);

/**
 * Resolves the cache policy for a given AI task.
 */
export function getTaskCachePolicy(task: string, scopeOverride?: CacheScope): AICachePolicy {
  const normalizedTask = task.toLowerCase().trim();

  // Guard against caching non-AI learning entities
  if (NON_CACHEABLE_ENTITIES.has(normalizedTask)) {
    return {
      enabled: false,
      allowExact: false,
      allowSemantic: false,
      scope: "DISABLED",
      ttlSeconds: 0,
      semanticSimilarityThreshold: 1.0,
    };
  }

  const defaultPolicy = TASK_CACHE_POLICIES[normalizedTask] || {
    enabled: false,
    allowExact: false,
    allowSemantic: false,
    scope: "DISABLED",
    ttlSeconds: 0,
    semanticSimilarityThreshold: 1.0,
  };

  if (scopeOverride) {
    return {
      ...defaultPolicy,
      scope: scopeOverride,
      enabled: scopeOverride !== "DISABLED" && defaultPolicy.enabled,
    };
  }

  return defaultPolicy;
}
