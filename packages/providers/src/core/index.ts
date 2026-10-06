/**
 * @forgeai/providers/core
 *
 * Core types and interfaces for the provider system.
 *
 * These types are deliberately framework-agnostic and do not depend on
 * React, Tauri, or any platform APIs. They form the contract that
 * the provider service, registry, and UI all depend on.
 */

/** A stable identifier for a provider type. */
export type ProviderId = string;

/** Distinguishes cloud vs local vs openai-compatible. */
export type ProviderKind = "cloud" | "local" | "openai-compatible";

/** What a provider is able to do. */
export type ProviderCapability =
  | "chat"
  | "streaming"
  | "tools"
  | "vision"
  | "embeddings"
  | "reasoning";

/** How a provider authenticates. Never contains a secret. */
export type AuthKind = "api-key" | "oauth" | "none";

/** Authentication shape description — safe to serialize and display. */
export interface ProviderAuthentication {
  readonly kind: AuthKind;
  /** Label for the credential field, e.g. "OpenAI API key". */
  readonly label: string;
  readonly documentationUrl?: string;
}

/** Non-secret metadata about a provider instance. */
export interface ProviderInstanceConfig {
  /** Stable provider type identifier, e.g. `openai`, `anthropic`. */
  readonly providerId: ProviderId;
  /** Human-readable display name. */
  readonly displayName: string;
  /** Provider kind for UI categorisation. */
  readonly kind: ProviderKind;
  /** Required authentication type. */
  readonly authentication: ProviderAuthentication;
  /** Non-secret endpoint configuration. */
  readonly defaultBaseUrl?: string;
  /** Currently selected model. */
  readonly model?: string;
  /** Whether this instance is enabled. */
  readonly enabled: boolean;
}

/** Identifies a specific provider instance within the application. */
export type ProviderInstanceId = string;

/** Human-scannable instance ID prefix convention: `{providerId}-{descriptor}` */
export function newProviderInstanceId(providerId: ProviderId, descriptor?: string): ProviderInstanceId {
  const suffix = descriptor ?? "default";
  return `${providerId}-${suffix}`;
}

/** The result of a provider connection test. */
export type ProviderConnectionResult =
  | { readonly type: "success"; readonly model: string }
  | { readonly type: "failure"; readonly error: string };

/** Error codes for provider operations. */
export type ProviderErrorCode =
  | "MISSING_CREDENTIAL"
  | "INVALID_CONFIGURATION"
  | "CONNECTION_FAILED"
  | "UNSUPPORTED_OPERATION"
  | "UNKNOWN_PROVIDER";

/** A provider-level error, safe to display in the UI. */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: ProviderId;
  readonly instanceId: string;

  constructor(
    message: string,
    code: ProviderErrorCode,
    providerId: ProviderId,
    instanceId: string,
    options?: { cause?: unknown; details?: Record<string, unknown> }
  ) {
    super(message, options?.cause);
    this.name = "ProviderError";
    this.code = code;
    this.providerId = providerId;
    this.instanceId = instanceId;
    this.details = options?.details ?? undefined;
  }
}

/** Creates a ProviderError from a code and context. */
export function createProviderError(
  code: ProviderErrorCode,
  providerId: ProviderId,
  instanceId: string,
  message: string,
): ProviderError {
  return new ProviderError(
    `${providerId}/${instanceId}: ${message}`,
    code,
    providerId,
    instanceId,
  );
}