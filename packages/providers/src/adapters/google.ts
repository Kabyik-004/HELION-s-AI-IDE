import type { Logger } from "@forgeai/shared";

import type { Provider, ProviderDescriptor, ProviderId } from "./provider-descriptor";
import type { ChatRequest, ChatResponse, ModelInfo } from "./chat";
import type { CredentialStorePort } from "@forgeai/shared";

import { FileSystemError } from "@forgeai/shared";

/** Google Gemini provider adapter. */
export class GoogleAdapter implements Provider {
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

  /** Lists available models from the Google Gemini API. */
  async listModels(): Promise<readonly ModelInfo[]> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Google AI API key not configured.",
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
    });

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Google models request failed: ${response.status}`,
      });
    }

    const data = await response.json();
    return (data.models || []).map((model: { name: string; displayName?: string; maxOutputTokens?: number }) => ({
      id: model.name!.split("/").pop()!,
      name: model.displayName || model.name!.split("/").pop()!,
      providerId: this.descriptor.id,
      capabilities: ["chat", "streaming", "tools", "vision", "embeddings"],
      maxOutputTokens: model.maxOutputTokens,
    }));
  }

  /** Sends a chat completion request to the Google Gemini API. */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Google AI API key not configured.",
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: request.messages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Google chat failed: ${response.status} ${text}`,
      });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "";
    const finishReason = candidate?.finishReason || "stop";

    return {
      message: {
        role: "assistant",
        content,
        toolCalls: undefined,
        toolCallId: undefined,
      },
      finishReason: this._mapFinishReason(finishReason),
      usage: undefined,
    };
  }

  /** Streams chat completion responses from the Google Gemini API. */
  async *streamChat(request: ChatRequest): AsyncIterable<ChatChunk> {
    const apiKey = await this.#credentialStore.get({ id: this.#credentialId });
    if (!apiKey) {
      throw FileSystemError.from({
        code: "missing-credential",
        message: "Google AI API key not configured.",
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:streamGenerateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: request.messages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            temperature: request.temperature,
            maxOutputTokens: request.maxTokens,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw FileSystemError.from({
        code: "io",
        message: `Google stream chat failed: ${response.status} ${text}`,
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
            const candidate = data.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text;
            if (content) {
              yield { type: "text-delta", text: content };
            }
            const finishReason = candidate?.finishReason;
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

  /** Maps Gemini finish reasons to ForgeAI finish reasons. */
  _mapFinishReason(reason: string): ChatResponse["finishReason"] {
    const mapping: Record<string, ChatResponse["finishReason"]> = {
      "STOP": "stop",
      "MAX_TOKENS": "length",
      "SAFETY": "content-filter",
      "RECITATION": "content-filter",
    };
    return mapping[reason] ?? "unknown";
  }
}