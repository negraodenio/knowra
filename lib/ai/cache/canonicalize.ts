import { createHash } from "crypto";
import { CanonicalRequestParams } from "./types";

/**
 * Deterministically sorts object keys deeply to guarantee identical serialization.
 */
export function deepSortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSortKeys);
  }

  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    result[key] = deepSortKeys((obj as Record<string, unknown>)[key]);
  }

  return result;
}

/**
 * Normalizes text while preserving educational / code syntax semantics.
 * Trims leading/trailing whitespace and normalizes CRLF to LF.
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text.replace(/\r\n/g, "\n").trim();
}

/**
 * Computes a standard SHA-256 hexadecimal hash string.
 */
export function sha256(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Generates the deterministic canonical request representation and its SHA-256 hash.
 * Includes all factors that materially affect LLM generation while excluding volatile metadata.
 */
export function canonicalizeRequest(params: CanonicalRequestParams): {
  canonicalString: string;
  hash: string;
} {
  const canonicalObject = {
    task: params.task.toLowerCase().trim(),
    model: params.model.toLowerCase().trim(),
    modelVersion: params.modelVersion ? params.modelVersion.trim() : null,
    promptVersion: params.promptVersion.trim(),
    schemaVersion: params.schemaVersion.trim(),
    policyVersion: params.policyVersion.trim(),
    normalizedInput: normalizeText(params.normalizedInput),
    domainId: params.domainId ? params.domainId.trim() : null,
    competencyId: params.competencyId ? params.competencyId.trim() : null,
    contextFingerprint: params.contextFingerprint ? params.contextFingerprint.trim() : null,
    scope: params.scope,
    // Contextual requests must be scoped to the specific learner
    userId: params.scope === "USER_CONTEXTUAL" ? params.userId || null : null,
  };

  const sorted = deepSortKeys(canonicalObject);
  const canonicalString = JSON.stringify(sorted);
  const hash = sha256(canonicalString);

  return { canonicalString, hash };
}

/**
 * Computes a deterministic SHA-256 hash for a response payload.
 */
export function hashResponsePayload(payload: unknown): string {
  const sorted = deepSortKeys(payload);
  const canonicalString = JSON.stringify(sorted);
  return sha256(canonicalString);
}
