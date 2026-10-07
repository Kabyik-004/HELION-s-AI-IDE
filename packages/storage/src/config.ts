import { createLogger, Emitter, type Disposable, type Logger } from "@forgeai/shared";

import type { KeyValueStore } from "./key-value-store";

/**
 * One configured provider instance.
 *
 * A provider *type* (e.g. `openai`) may be configured more than once, so each configured
 * instance carries its own unique `id` (e.g. `openai-personal`, `openai-work`). This lets a
 * developer keep separate credentials and endpoints for the same provider.
 *
 * SECURITY: this is **non-secret configuration only**. The API key for an instance is stored
 * separately in the secure credential store under `provider:<id>:apiKey` and must never be
 * added to this type.
 */
export interface ProviderInstanceConfig {
  /** Unique instance id, e.g. `openai-personal`. Never a secret. */
  readonly id: string;
  /** Provider type, matching a `ProviderDescriptor.id` (e.g. `openai`). */
  readonly providerType: string;
  /** Human-readable label shown in the UI, e.g. `OpenAI — Personal`. */
  readonly displayName: string;
  /** Non-secret endpoint override; falls back to the descriptor's default. */
  readonly baseUrl?: string;
  /** Model id selected for this instance. */
  readonly model?: string;
  /** Disabled instances stay configured but cannot be made active. */
  readonly enabled: boolean;
}

/**
 * All of ForgeAI's user preferences.
 *
 * SECURITY: this type must never contain a secret. API keys live in the OS credential store
 * (`SecureCredentialStore`); only non-secret references and preferences belong here. Any
 * addition to this type should be reviewed with that rule in mind.
 */
export interface ForgeAIConfig {
  readonly version: number;
  readonly provider: {
    /** Active provider **instance** id, or undefined when nothing is selected. */
    readonly selectedProviderId?: string;
    /** Every configured provider instance. Non-secret; keys live in the credential store. */
    readonly instances: readonly ProviderInstanceConfig[];
  };
  readonly project: {
    /** Absolute paths, most-recent first. */
    readonly recentProjects: readonly string[];
  };
  readonly agent: {
    readonly maxIterations: number;
    /** When true, `SAFE` tools run without prompting. `MODERATE`/`DANGEROUS` always prompt. */
    readonly autoApproveSafeTools: boolean;
  };
  readonly permissions: {
    /** `deny` refuses anything the policy does not explicitly allow. */
    readonly defaultPolicy: "ask" | "deny";
    readonly rememberSessionGrants: boolean;
  };
  readonly ui: {
    readonly theme: "system" | "light" | "dark";
    readonly sidebarWidth: number;
  };
}

/** Bumped whenever the shape changes, so a future migration can detect old files. */
export const CONFIG_VERSION = 2;

export const DEFAULT_CONFIG: ForgeAIConfig = {
  version: CONFIG_VERSION,
  provider: { instances: [] },
  project: { recentProjects: [] },
  agent: { maxIterations: 25, autoApproveSafeTools: true },
  permissions: { defaultPolicy: "ask", rememberSessionGrants: true },
  ui: { theme: "dark", sidebarWidth: 260 },
};

/** A recursive partial, so callers can patch one nested setting at a time. */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? readonly U[]
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export interface ConfigService {
  /** Reads persisted configuration (falling back to defaults) and caches it. */
  load(): Promise<ForgeAIConfig>;
  /** The currently cached configuration. Never throws. */
  get(): ForgeAIConfig;
  /** Merges a partial update, persists it, and notifies subscribers. */
  update(patch: DeepPartial<ForgeAIConfig>): Promise<ForgeAIConfig>;
  save(config: ForgeAIConfig): Promise<ForgeAIConfig>;
  /** Restores defaults and persists them. */
  reset(): Promise<ForgeAIConfig>;
  subscribe(listener: (config: ForgeAIConfig) => void): Disposable;
}

export interface DefaultConfigServiceOptions {
  readonly store: KeyValueStore;
  /** Storage key. Overridable so tests can isolate their state. */
  readonly key?: string;
  readonly logger?: Logger;
}

/**
 * Configuration service backed by a `KeyValueStore`.
 *
 * Real and complete: it merges defaults, persists, and publishes changes. Swapping the
 * in-memory store for a file-backed one later requires no change here.
 */
export class DefaultConfigService implements ConfigService {
  readonly #store: KeyValueStore;
  readonly #key: string;
  readonly #logger: Logger;
  readonly #emitter = new Emitter<ForgeAIConfig>();

  #config: ForgeAIConfig = DEFAULT_CONFIG;

  constructor(options: DefaultConfigServiceOptions) {
    this.#store = options.store;
    this.#key = options.key ?? "forgeai.config";
    this.#logger = options.logger ?? createLogger("storage:config");
  }

  async load(): Promise<ForgeAIConfig> {
    const stored = await this.#store.get<ForgeAIConfig>(this.#key);
    // Merge over defaults so a config written by an older version is still usable.
    this.#config = stored === undefined ? DEFAULT_CONFIG : mergeConfig(DEFAULT_CONFIG, stored);
    this.#logger.debug("configuration loaded", { hasStoredValue: stored !== undefined });
    this.#emitter.emit(this.#config);
    return this.#config;
  }

  get(): ForgeAIConfig {
    return this.#config;
  }

  async update(patch: DeepPartial<ForgeAIConfig>): Promise<ForgeAIConfig> {
    return this.save(mergeConfig(this.#config, patch));
  }

  async save(config: ForgeAIConfig): Promise<ForgeAIConfig> {
    this.#config = config;
    await this.#store.set(this.#key, config);
    this.#emitter.emit(config);
    return config;
  }

  async reset(): Promise<ForgeAIConfig> {
    return this.save(DEFAULT_CONFIG);
  }

  subscribe(listener: (config: ForgeAIConfig) => void): Disposable {
    return this.#emitter.on(listener);
  }
}

function mergeConfig(base: ForgeAIConfig, patch: DeepPartial<ForgeAIConfig>): ForgeAIConfig {
  // The recursion is untyped internally; the public signature keeps callers type-safe.
  return mergeObjects(
    base as unknown as Record<string, unknown>,
    patch as unknown as Record<string, unknown>,
  ) as unknown as ForgeAIConfig;
}

function mergeObjects(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const current = result[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      result[key] = mergeObjects(current, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
