import type { JsonSchema } from "@forgeai/tools";

import type { ProviderCapability, ProviderId } from "./provider-descriptor";

/** One model offered by a provider. */
export interface ModelInfo {
  /** Model id sent to the provider, e.g. `gpt-4o-mini`. */
  readonly id: string;
  /** Friendly name for the UI. */
  readonly name: string;
  readonly providerId: ProviderId;
  readonly capabilities: readonly ProviderCapability[];
  readonly contextWindow?: number;
  readonly maxOutputTokens?: number;
  readonly deprecated?: boolean;
}

/** A tool definition in the shape a model expects, when calling tools is supported. */
export interface ProviderToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}
