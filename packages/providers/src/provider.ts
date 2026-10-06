import type { CredentialStorePort, Logger } from "@forgeai/shared";

import type { ChatChunk, ChatRequest, ChatResponse } from "./chat";
import type { ModelInfo } from "./model";
import type { ProviderDescriptor, ProviderId } from "./provider-descriptor";

/**
 * The contract the rest of ForgeAI programs against.
 *
 * There is deliberately **no implementation** of `Provider` in Module 0. Adapters that talk
 * to OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, Ollama and custom
 * OpenAI-compatible endpoints arrive in Module 3. Shipping a stub here would be a fake
 * implementation, and ForgeAI's development principles forbid that.
 *
 * TODO(module-3): implement adapters for the providers listed in `PROVIDER_CATALOG`.
 */
export interface Provider {
  readonly descriptor: ProviderDescriptor;
  /** Models available with the current credentials. May hit the network. */
  listModels(): Promise<readonly ModelInfo[]>;
  /** One-shot completion. */
  chat(request: ChatRequest): Promise<ChatResponse>;
  /** Incremental completion. Only required when `streaming` is advertised. */
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
  /** Releases sockets, timers and any cached state. */
  dispose(): Promise<void>;
}

export interface CreateProviderOptions<TConfig = unknown> {
  /** Non-secret provider configuration (base URL, organisation, local model list, ...). */
  readonly config: TConfig;
  /** Used by the adapter to fetch its API key. Never a raw secret in config. */
  readonly credentials: CredentialStorePort;
  readonly logger?: Logger;
  /** Non-secret reference the adapter uses to look up its own credential. */
  readonly credentialId: string;
}

/**
 * Builds providers.
 *
 * Keeping construction behind a factory means the registry can be populated without any
 * caller importing a concrete provider module, so adding a provider never touches the UI.
 */
export interface ProviderFactory<TConfig = unknown> {
  readonly descriptor: ProviderDescriptor;
  create(options: CreateProviderOptions<TConfig>): Provider;
}

/**
 * A `ProviderFactory` with its config type erased.
 *
 * Factories of different config shapes live in one registry, so the boundary is untyped.
 * Kept in one alias so the escape hatch is explicit and reviewable.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export type AnyProviderFactory = ProviderFactory<any>;

/** Looks up provider factories by id. */
export interface ProviderRegistry {
  register(factory: AnyProviderFactory): void;
  get(id: ProviderId): AnyProviderFactory | undefined;
  has(id: ProviderId): boolean;
  /** Metadata for every registered provider, safe for the UI. */
  listDescriptors(): readonly ProviderDescriptor[];
}
