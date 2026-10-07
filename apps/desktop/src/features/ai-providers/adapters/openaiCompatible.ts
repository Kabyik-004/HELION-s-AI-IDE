import type { CredentialStorePort, Logger } from "@forgeai/shared";

import { ProviderError, codeForStatus } from "@forgeai/providers";
import type {
  ChatChunk,
  ChatRequest,
  ChatResponse,
  ModelInfo,
  Provider,
  ProviderDescriptor,
} from "@forgeai/providers";

interface OpenAIMessage {
  readonly role?: string;
  readonly content?: string | null;
}

interface OpenAIChoice {
  readonly message?: OpenAIMessage;
  readonly finish_reason?: string | null;
}

interface OpenAIChatResponse {
  readonly choices?: readonly OpenAIChoice[];
  readonly usage?: { readonly prompt_tokens: number; readonly completion_tokens: number };
}

/**
 * Base class for OpenAI-compatible provider adapters.
 *
 * Handles the shared request/response format used by OpenAI, OpenRouter, Groq, Mistral, Ollama
 * and custom OpenAI-compatible endpoints.
 *
 * The API key is resolved **lazily from the credential store on every request**. A factory can
 * therefore construct an adapter before a key exists, and the secret never becomes a field of this
 * object, never enters configuration and never reaches React state.
 */
export class OpenAICompatibleAdapter implements Provider {
  readonly descriptor: ProviderDescriptor;
  readonly #baseUrl: string;
  readonly #credentials: CredentialStorePort;
  readonly #credentialId: string;
  readonly #logger: Logger;

  constructor(
    descriptor: ProviderDescriptor,
    baseUrl: string,
    credentials: CredentialStorePort,
    credentialId: string,
    logger: Logger,
  ) {
    this.descriptor = descriptor;
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
    this.#credentials = credentials;
    this.#credentialId = credentialId;
    this.#logger = logger.child(`provider:${descriptor.id}`);
  }

  /** Builds the request headers, fetching the key only when the provider needs one. */
  async #headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.descriptor.authentication.kind === "none") return headers;

    const apiKey = await this.#credentials.get({ id: this.#credentialId });
    if (apiKey === undefined || apiKey.length === 0) {
      throw new ProviderError("missingCredential", `No API key is configured for ${this.descriptor.name}.`, {
        providerId: this.descriptor.id,
      });
    }
    headers.Authorization = `Bearer ${apiKey}`;
    return headers;
  }

  /** Sends a request, translating transport failures into a `ProviderError`. */
  async #send(path: string, init: RequestInit): Promise<Response> {
    this.#logger.debug("provider request", {
      providerId: this.descriptor.id,
      method: init.method ?? "GET",
      path,
    });
    try {
      return await fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: { ...(await this.#headers()), ...(init.headers ?? {}) },
      });
    } catch (cause) {
      throw new ProviderError("networkError", `Could not reach ${this.descriptor.name}.`, {
        providerId: this.descriptor.id,
        detail: cause instanceof Error ? cause.message : String(cause),
        cause,
      });
    }
  }

  /** Turns a non-2xx response into a `ProviderError`, without echoing request credentials. */
  async #httpError(response: Response): Promise<ProviderError> {
    const code = codeForStatus(response.status);
    let detail: string | undefined;
    try {
      detail = (await response.text()).slice(0, 500);
    } catch {
      detail = undefined;
    }
    const message =
      code === "authenticationFailed"
        ? `The ${this.descriptor.name} API key was rejected.`
        : code === "rateLimited"
          ? `${this.descriptor.name} is rate limiting requests. Try again shortly.`
          : code === "invalidEndpoint"
            ? `The ${this.descriptor.name} endpoint was not found. Check the base URL.`
            : `${this.descriptor.name} returned HTTP ${response.status}.`;
    return new ProviderError(code, message, {
      providerId: this.descriptor.id,
      status: response.status,
      detail,
    });
  }

  /** Sends a request and decodes a JSON response. */
  async #request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.#send(path, init);
    if (!response.ok) throw await this.#httpError(response);
    try {
      return (await response.json()) as T;
    } catch (cause) {
      throw new ProviderError("invalidResponse", `${this.descriptor.name} returned a response that could not be read.`, {
        providerId: this.descriptor.id,
        cause,
      });
    }
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    const response = await this.#request<{ data?: readonly { id?: unknown }[] }>("/models", { method: "GET" });
    const data = Array.isArray(response.data) ? response.data : [];
    return data
      .filter((model): model is { id: string } => typeof model.id === "string")
      .map((model) => ({
        id: model.id,
        name: model.id,
        providerId: this.descriptor.id,
        capabilities: this.descriptor.capabilities,
      }));
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.#request<OpenAIChatResponse>("/chat/completions", {
      method: "POST",
      body: JSON.stringify(this.#toProviderRequest(request)),
    });

    const choice = response.choices?.[0];
    if (choice === undefined) {
      throw new ProviderError("invalidResponse", `${this.descriptor.name} returned no choices.`, {
        providerId: this.descriptor.id,
      });
    }

    return {
      message: { role: "assistant", content: choice.message?.content ?? "" },
      finishReason: this.#mapFinishReason(choice.finish_reason ?? null),
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens }
        : undefined,
    };
  }

  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const response = await this.#send("/chat/completions", {
      method: "POST",
      body: JSON.stringify({ ...this.#toProviderRequest(request), stream: true }),
    });

    if (!response.ok) throw await this.#httpError(response);
    if (response.body === null) {
      throw new ProviderError("invalidResponse", `${this.descriptor.name} returned an empty stream.`, {
        providerId: this.descriptor.id,
      });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { type: "done", finishReason: "stop" };
            return;
          }

          try {
            const chunk = JSON.parse(payload) as {
              choices?: readonly { delta?: { content?: string }; finish_reason?: string | null }[];
            };
            const choice = chunk.choices?.[0];
            if (choice?.delta?.content !== undefined && choice.delta.content.length > 0) {
              yield { type: "text-delta", text: choice.delta.content };
            }
            if (choice?.finish_reason !== undefined && choice.finish_reason !== null) {
              yield { type: "done", finishReason: this.#mapFinishReason(choice.finish_reason) };
              return;
            }
          } catch {
            // A partial chunk is normal in SSE; the next read completes it.
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async dispose(): Promise<void> {
    // fetch keeps no persistent connection state to release.
  }

  #toProviderRequest(request: ChatRequest): Record<string, unknown> {
    return {
      model: request.model,
      messages: request.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.toolCalls !== undefined && message.toolCalls.length > 0
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function",
                function: { name: call.name, arguments: call.argumentsJson },
              })),
            }
          : {}),
        ...(message.toolCallId !== undefined ? { tool_call_id: message.toolCallId } : {}),
      })),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
      ...(request.tools !== undefined ? { tools: request.tools } : {}),
    };
  }

  #mapFinishReason(reason: string | null): ChatResponse["finishReason"] {
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
