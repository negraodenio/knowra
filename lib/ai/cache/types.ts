/**
 * AI Response Cache Type Definitions (§S7.8)
 * Defines cache scopes, layers, policies, keys, and lookup results.
 */

export type CacheScope = "SHARED" | "USER_CONTEXTUAL" | "DISABLED";
export type CacheLayer = "L1_EXACT" | "L2_SEMANTIC" | "NONE";
export type CacheType = "EXACT" | "SEMANTIC";

export interface AICachePolicy {
  enabled: boolean;
  allowExact: boolean;
  allowSemantic: boolean;
  scope: CacheScope;
  ttlSeconds: number;
  semanticSimilarityThreshold: number;
}

export interface CanonicalRequestParams {
  task: string;
  model: string;
  modelVersion?: string;
  promptVersion: string;
  schemaVersion: string;
  policyVersion: string;
  normalizedInput: string;
  domainId?: string;
  competencyId?: string;
  contextFingerprint?: string;
  userId?: string;
  scope: CacheScope;
}

export interface AICacheEntry {
  id?: string;
  cacheKeyHash: string;
  task: string;
  cacheType: CacheType;
  scope: CacheScope;
  userId?: string;
  model: string;
  modelVersion?: string;
  promptVersion: string;
  schemaVersion: string;
  policyVersion: string;
  domainId?: string;
  competencyId?: string;
  normalizedInput: string;
  contextFingerprint?: string;
  responsePayload: unknown;
  responseHash: string;
  embedding?: number[];
  validationStatus: "VALIDATED" | "INVALIDATED";
  qualityStatus: "PASSED" | "FLAGGED";
  metadata?: Record<string, unknown>;
  hitCount?: number;
  createdAt?: Date;
  lastHitAt?: Date;
  expiresAt: Date;
}

export interface AICacheLookupResult<T = unknown> {
  hit: boolean;
  layer: CacheLayer;
  data?: T;
  rawText?: string;
  cacheKeyHash?: string;
  cachedModel?: string;
  similarity?: number;
  latencyMs: number;
  recordId?: string;
  estimatedCostSaved?: number;
}

export interface AICacheTelemetryEvent {
  cacheEnabled: boolean;
  cacheType?: CacheType;
  cacheLayer: CacheLayer;
  cacheHit: boolean;
  cacheKeyHash?: string;
  semanticSimilarity?: number;
  cacheLatencyMs: number;
  cacheLookupError?: string;
  cacheWriteError?: string;
  task: string;
  model: string;
  estimatedCostSaved: number;
  llmCallsAvoided: number;
  policyVersion: string;
}
