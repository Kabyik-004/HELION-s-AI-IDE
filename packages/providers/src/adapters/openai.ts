import type { Logger } from "@forgeai/shared";

import type { Provider, ProviderDescriptor, ProviderId } from "./provider-descriptor";
import type { ChatRequest, ChatResponse, ModelInfo } from "./chat";
import type { CredentialStorePort } from "@forgeai/shared";

import { FileSystemError } from "@forgeai/shared";

/** OpenAI provider adapter. */
export class OpenAIAdapter implements Provider {
  readonly descriptor: ProviderDescriptor;
  readonly #credentialStore: CredentialStorePort;
  readonly #credentialId: string;
  readonly #logger: Logger;

  constructor(
    descriptor: ProviderDescriptor,
    credentialStore: CredentialStorePort,
    credentialId: string,
    logger: Logger,
  ) {
    this.descriptor = descriptor;
    this.#credentialStore = credentialStore;
    this.#credentialId = credentialId;
    this.#logger = logger.child(`provider:${descriptor.id}`);
  }

  /** Lists available models from the OpenAI API. */
  async listModels(): Promise<readonly ModelInfo[]> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "OpenAI API key not configured.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `OpenAI models request failed: ${response.status}`,
      });
    }

    const data = await response.json();
    return data.data.map((model: { id: string; name: string; max_output_tokens?: number; context_window?: number; deprecated?: boolean }) => ({
      id: model.id,
      name: model.name || model.id,
      providerId: this.descriptor.id,
      capabilities: this._capabilitiesFromModel(model),
      contextWindow: model.context_window,
      maxOutputTokens: model.max_output_tokens,
      deprecated: model.deprecated ?? false,
    }));
  }

  /** Sends a chat completion request to the OpenAI API. */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "OpenAI API key not configured.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.toolCalls && msg.toolCalls.length > 0
            ? { tool_calls: msg.toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: tc.argumentsJson,
                },
              ))}
            )})
            : {}),
        })),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `OpenAI chat failed: ${response.status} ${text}`,
      });
    }

    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    let finishReason: ChatResponse["finishReason"] = "stop";
    if (choice.finish_reason) {
      switch (choice.finish_reason) {
        case "stop": finishReason = "stop"; break;
        case "length": finishReason = "length"; break;
        case "tool_calls": finishReason = "tool-calls"; break;
        case "content_filter": finishReason = "content-filter"; break;
        default: finishReason = "unknown"; break;
      }
    }

    return {
      message: {
        role: message.role || "assistant",
        content: message.content || "",
        toolCalls: undefined,
        toolCallId: undefined,
      },
      finishReason,
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    };
  }

  /** Streams chat completion responses from the OpenAI API. */
  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "OpenAI API key not configured.",
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          ...(msg.toolCalls && msg.toolCalls.length > 0
            ? { tool_calls: msg.toolCalls.map(tc => ({
                id: tc.id,
                type: "function",
                function: {
                  name: tc.name,
                  arguments: tc.argumentsJson,
                },
              ))}
            )})
            : {}),
        }),
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        tools: request.tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `OpenAI stream chat failed: ${response.status} ${text}`,
      });
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

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
                yield { type: "tool-call", toolCall };
              }
            }
            const finishReason = data.choices?.[0]?.finish_reason;
            if (finishReason) {
              const mapped = this._mapFinishReason(finishReason);
              yield { type: "done", finishReason: mapped };
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

  /** Disposes of any resources held by the adapter. */
  async dispose(): Promise<void> {
    // No persistent connections to clean up
  }

  /** Maps OpenAI finish reasons to ForgeAI finish reasons. */
  #mapFinishReason(reason: string): ChatResponse["finishReason"] {
    switch (reason) {
      case "stop": return "stop";
      case "length": return "length";
      case "tool_calls": return "tool-calls";
      case "content_filter": return "content-filter";
      default: return "unknown";
    }
  }

  /** Extracts model capabilities from the OpenAI model info. */
  #capabilitiesFromModel(model: unknown): readonly string[] {
    const caps: string[] = ["chat", "streaming", "tools"];
    return caps;
  }
}