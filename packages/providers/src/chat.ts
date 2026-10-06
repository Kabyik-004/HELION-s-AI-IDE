import type { ProviderToolSpec } from "./model";

/**
 * Provider-neutral chat vocabulary.
 *
 * Every provider (OpenAI, Anthropic, Gemini, Ollama, ...) exposes a different shape for
 * chat completion. Adapters translate to and from these types so that the rest of ForgeAI
 * never sees a provider-specific payload.
 */

export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A model's request to invoke a tool, encoded as returned by the provider. */
export interface ProviderToolCall {
  readonly id: string;
  readonly name: string;
  /** Raw JSON string of arguments, exactly as the model produced it. Not yet validated. */
  readonly argumentsJson: string;
}

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
  /** Set on `tool` messages to link the result back to the call. */
  readonly toolCallId?: string;
  /** Tool calls the assistant asked for. */
  readonly toolCalls?: readonly ProviderToolCall[];
}

export type FinishReason = "stop" | "length" | "tool-calls" | "content-filter" | "error" | "unknown";

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly ChatMessage[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  /** Present only when the provider advertises the `tools` capability. */
  readonly tools?: readonly ProviderToolSpec[];
  /** Lets a caller cancel an in-flight request. */
  readonly signal?: AbortSignal;
}

/**
 * One piece of a streamed response.
 *
 * The union is what allows the UI to render tokens as they arrive, surface tool calls the
 * moment the model emits them, and show usage — all without knowing which provider replied.
 */
export type ChatChunk =
  | { readonly type: "text-delta"; readonly text: string }
  | { readonly type: "tool-call"; readonly toolCall: ProviderToolCall }
  | { readonly type: "usage"; readonly usage: TokenUsage }
  | { readonly type: "done"; readonly finishReason: FinishReason };

/** A non-streamed completion. */
export interface ChatResponse {
  readonly message: ChatMessage;
  readonly finishReason: FinishReason;
  readonly usage?: TokenUsage;
}
