import { logger } from "@/lib/observability/logger";

export const VERIFIED_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const VERIFIED_EMBEDDING_DIMENSION = 1536;

export interface EmbeddingOptions {
  model?: string;
  timeoutMs?: number;
}

export class EmbeddingService {
  private get apiKey(): string {
    return process.env.OPENROUTER_API_KEY || "";
  }

  private get baseUrl(): string {
    return process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  }

  public isSemanticCacheEnabled(): boolean {
    return process.env.ENABLE_SEMANTIC_CACHE !== "false";
  }

  /**
   * Generates a 1536-dimensional vector embedding for the input text.
   * Fails safely by returning null if network, auth, or model errors occur.
   */
  async embed(text: string, options?: EmbeddingOptions): Promise<number[] | null> {
    if (!this.isSemanticCacheEnabled() || !this.apiKey || !text.trim()) {
      return null;
    }

    const model = options?.model || process.env.EMBEDDING_MODEL || VERIFIED_EMBEDDING_MODEL;
    const timeoutMs = options?.timeoutMs || 10000;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://knowra.eduia.internal",
          "X-Title": "Knowra Learning Platform",
        },
        body: JSON.stringify({
          model,
          input: text.slice(0, 8000), // Protect against excessive input lengths
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        logger.warn(`Embedding API returned non-200: ${response.status}`, { errorText, model });
        return null;
      }

      const data = await response.json();
      const embedding = data?.data?.[0]?.embedding;

      if (!Array.isArray(embedding) || embedding.length !== VERIFIED_EMBEDDING_DIMENSION) {
        logger.warn(`Unexpected embedding dimensions: ${embedding?.length} (expected ${VERIFIED_EMBEDDING_DIMENSION})`);
        return null;
      }

      return embedding;
    } catch (err: unknown) {
      logger.warn("Embedding generation failed safely (semantic cache bypassed)", {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Generates vector embeddings for a batch of text strings.
   */
  async embedBatch(texts: string[], options?: EmbeddingOptions): Promise<(number[] | null)[]> {
    return Promise.all(texts.map((t) => this.embed(t, options)));
  }
}

export const embeddingService = new EmbeddingService();
