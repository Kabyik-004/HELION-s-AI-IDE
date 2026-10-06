import type { Logger } from "@forgeai/shared";

import type { Provider, ProviderDescriptor, ProviderId } from "./provider-descriptor";
import type { ChatRequest, ChatResponse, ModelInfo } from "./chat";
import type { CredentialStorePort } from "@forgeai/shared";

import { FileSystemError } from "@forgeai/shared";

/** Anthropic provider adapter. */
export class AnthropicAdapter implements Provider {
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

  /** Lists available models from the Anthropic API. */
  async listModels(): Promise<readonly ModelInfo[]> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Anthropic API key not configured.",
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Anthropic-Version": "2023-06-01",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Anthropic models request failed: ${response.status}`,
      });
    }

    const data = await response.json();
    return (data.data || []).map((model: { id: string; name: string; max_tokens?: number }) => ({
      id: model.id,
      name: model.name || model.id,
      providerId: this.descriptor.id,
      capabilities: ["chat", "streaming", "tools", "vision", "reasoning"],
      maxOutputTokens: model.max_tokens,
    }));
  }

  /** Sends a chat completion request to the Anthropic API. */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Anthropic API key not configured.",
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Anthropic-Version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Anthropic chat failed: ${response.status} ${text}`,
      });
    }

    const data = await response.json();
    const message = data.content?.[0]?.type === "text" ? data.content[0].text : "";

    let finishReason: ChatResponse["finishReason"] = "stop";
    if (data.stop_reason) {
      switch (data.stop_reason) {
        case "end_turn": finishReason = "stop"; break;
        case "max_tokens": finishReason = "length"; break;
        default: finishReason = "unknown"; break;
      }
    }

    return {
      message: {
        role: "assistant",
        content: message,
        toolCalls: undefined,
        toolCallId: undefined,
      },
      finishReason,
      usage: data.usage
        ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
        : undefined,
    };
  }

  /** Streams chat completion responses from the Anthropic API. */
  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Anthropic API key not configured.",
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "Anthropic-Version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        messages: request.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Anthropic stream chat failed: ${response.status} ${text}`,
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
            const textBlock = data.content?.[0]?.type === "text" ? data.content[0].text : "";
            if (textBlock) {
              yield { type: "text-delta", text: textBlock };
            }
            const stopReason = data.stop_reason;
            if (stopReason) {
              const mapped = this._mapFinishReason(stopReason);
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

  /** Maps Anthropic stop reasons to ForgeAI finish reasons. */
  #mapFinishReason(reason: string): ChatResponse["finishReason"] {
    switch (reason) {
      case "end_turn": return "stop";
      case "max_tokens": return "length";
      default: return "unknown";
    }
  }
}