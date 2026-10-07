import { logger } from "@/lib/observability/logger";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterRequestOptions {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: "json_object" };
  timeoutMs?: number;
  maxRetries?: number;
}

export interface OpenRouterResponse {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
    this.baseUrl = baseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  }

  async complete(options: OpenRouterRequestOptions): Promise<OpenRouterResponse> {
    const {
      model,
      messages,
      temperature = 0.2,
      maxTokens = 2048,
      responseFormat,
      timeoutMs = 45000,
      maxRetries = 2,
    } = options;

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured in the environment.");
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            "HTTP-Referer": "https://eduia.local",
            "X-Title": "EDUIA Learning Platform",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(responseFormat ? { response_format: responseFormat } : {}),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(
            `OpenRouter HTTP error (${response.status} ${response.statusText}): ${errorBody}`
          );
        }

        const data = await response.json();
        const choice = data.choices?.[0];
        const content = choice?.message?.content || "";
        const promptTokens = data.usage?.prompt_tokens ?? 0;
        const completionTokens = data.usage?.completion_tokens ?? 0;

        return {
          content,
          model: data.model || model,
          promptTokens,
          completionTokens,
        };
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempt++;

        if (attempt <= maxRetries) {
          const backoffMs = Math.pow(2, attempt) * 500;
          logger.warn(`OpenRouter request failed (attempt ${attempt}/${maxRetries}). Retrying in ${backoffMs}ms...`, {
            model,
            error: lastError.message,
          });
          await new Promise((res) => setTimeout(res, backoffMs));
        }
      }
    }

    throw lastError || new Error("OpenRouter request failed after retries.");
  }
}

export const openRouterClient = new OpenRouterClient();
