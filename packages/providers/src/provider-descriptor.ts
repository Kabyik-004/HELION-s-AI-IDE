/** Stable provider identifier, e.g. `openai`, `anthropic`, `ollama`. */
export type ProviderId = string;

/** Where the model actually runs. Useful for privacy messaging in the UI. */
export type ProviderKind = "cloud" | "local" | "openai-compatible";

/** What a provider (or a specific model) is able to do. */
export type ProviderCapability =
  | "chat"
  | "streaming"
  | "tools"
  | "vision"
  | "embeddings"
  | "reasoning";

/** How a provider authenticates. Describes the *shape* of auth, never a secret. */
export type AuthKind = "api-key" | "oauth" | "none";

export interface ProviderAuthentication {
  readonly kind: AuthKind;
  /** Label for the credential field, e.g. "OpenAI API key". */
  readonly label: string;
  readonly documentationUrl?: string;
}

/**
 * Static, non-secret metadata about a provider.
 *
 * This is the only part of a provider that is safe to show in the UI, log, or serialize —
 * which is why the catalogue is built from descriptors.
 */
export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly name: string;
  readonly kind: ProviderKind;
  readonly authentication: ProviderAuthentication;
  readonly capabilities: readonly ProviderCapability[];
  readonly homepage?: string;
  /** Default non-secret endpoint, e.g. `https://api.openai.com/v1`. */
  readonly defaultBaseUrl?: string;
}
