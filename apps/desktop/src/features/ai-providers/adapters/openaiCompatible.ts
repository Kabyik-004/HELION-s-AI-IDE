import { FileSystemError } from "@forgeai/shared";

import type { CredentialStorePort, Logger } from "@forgeai/shared";
import type { ChatChunk, ChatRequest, ChatResponse, ModelInfo, Provider, ProviderDescriptor, ProviderId } from "@forgeai/providers";

/**
 * Base class for OpenAI-compatible provider adapters.
 *
 * Handles the common request/response format for OpenAI-compatible APIs.
 */
export abstract class OpenAICompatibleAdapter implements Provider {
  readonly descriptor: ProviderDescriptor;
  readonly #baseUrl: string;
  readonly #apiKey: string;
  readonly #logger: Logger;

  protected constructor(
    descriptor: ProviderDescriptor,
    baseUrl: string,
    apiKey: string,
    logger: Logger,
  ) {
    this.descriptor = descriptor;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#apiKey = apiKey;
    this.#logger = logger.child(`provider:${descriptor.id}`);
  }

  /** Creates the standard headers for API requests. */
  #headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.#apiKey}`,
    };
  }

  /** Builds the full URL for an endpoint. */
  #url(path: string): string {
    return `${this.#baseUrl}${path}`;
  }

  /** Performs an HTTP request with error handling. */
  async #request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = this.#url(path);
    this.#logger.debug("HTTP request", { method: options.method ?? "GET", path });

    const response = await fetch(url, {
      ...options,
      headers: { ...this.#headers(), ...options.headers },
    });

    if (!response.ok) {
      let detail: string;
      try {
        detail = await response.text();
      } catch {
        detail = `HTTP ${response.status}`;
      }
      throw FileSystemError.from({
        code: "io",
        message: `Provider ${this.descriptor.name} returned ${response.status}: ${detail}`,
      });
    }

    return response.json();
  }

  /** Performs a streaming HTTP request. */
  async #streamRequest(path: string, options: RequestInit = {}): Promise<ReadableStream<Uint8Array>> {
    const url = this.#url(path);
    this.#logger.debug("HTTP stream request", { method: options.method ?? "POST", path });

    const response = await fetch(url, {
      ...options,
      headers: { ...this.#headers(), ...options.headers },
    });

    if (!response.ok) {
      let detail: string;
      try {
        detail = await response.text();
      } catch {
        detail = `HTTP ${response.status}`;
      }
      throw FileSystemError.from({
        code: "io",
        message: `Provider ${this.descriptor.name} returned ${response.status}: ${detail}`,
      });
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }
    return response.body;
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    const response = await this.#request<{ data: Array<{ id: string; object: string }> }>("/models");
    return response.data.map((model) => ({
      id: model.id,
      name: model.id,
      providerId: this.descriptor.id,
      capabilities: this.descriptor.capabilities,
    }));
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.#request<{
      choices: Array<{ message: { role: string; content: string | null }; finish_reason: string | null }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    }>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(this.#toProviderRequest(request)),
    });

    const choice = response.choices[0];
    const message = choice.message;
    const finishReason = this.#mapFinishReason(choice.finish_reason);

    return {
      message: {
        role: message.role as "assistant",
        content: message.content ?? "",
        toolCalls: undefined,
      },
      finishReason,
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
        : undefined,
    };
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const stream = await this.#streamRequest("/chat/completions", {
      method: "POST",
      body: JSON.stringify({ ...this.#toProviderRequest(request), stream: true }),
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          if (trimmed === "data: [DONE]") {
            yield { type: "done", finishReason: "stop" };
            return;
          }

          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta;
            if (delta?.content) {
              yield { type: "text-delta", text: delta.content };
            }
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                yield { type: "tool-call", toolCall: toolCall };
              }
            }
            const finishReason = data.choices?.[0]?.finish_reason;
            if (finishReason) {
              yield { type: "done", finishReason: this.#mapFinishReason(finishReason) };
              return;
            }
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async dispose(): Promise<void> {
    // No persistent connections to clean up
  }

  #toProviderRequest(request: ChatRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        tool_calls: msg.toolCalls,
        tool_call_id: msg.toolCallId,
      })),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      tools: request.tools,
    };
  }

  #mapFinishReason(reason: string | null): "stop" | "length" | "tool-calls" | "content-filter" | "error" | "unknown" {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool-calls";
      case "content_filter":
        return "content-filter";
      default:
        return "unknown";
    }
  }
}