/**
 * @forgeai/providers/core/provider-configuration-service
 *
 * Provider configuration service manages provider instances, their configurations,
 * credentials, and active state.
 *
 * SECURITY:
 * - Non-secret configuration persists via ConfigService (JSON, safe to serialize)
 * - Secrets (API keys) are stored in SecureCredentialStore (OS keychain)
 * - The UI never sees raw API keys
 * - Changing active provider never copies credentials into UI state
 */

import { CONFIG_VERSION } from "@forgeai/storage";
import { newProviderInstanceId, type ProviderInstanceId, type ProviderInstanceConfig, type ProviderError, type ProviderErrorCode, type ProviderCapability, type AuthKind, type ProviderId } from "./index";
import { DefaultProviderRegistry } from "./registry";
import type { SecretReference } from "@forgeai/shared";
import type { ConfigService } from "@forgeai/storage";
import type { SecureCredentialStore } from "@forgeai/storage";
import { createLogger } from "@forgeai/shared";

/**
 * Options for initializing the provider configuration service.
 */
export interface ProviderConfigurationServiceOptions {
  /** Service for persisting non-secret configuration. */
  configService: ConfigService;
  /** Storage for secret credentials (API keys, etc.). */
  credentialStore: SecureCredentialStore;
  /** Pre-registered provider factories. */
  registry?: DefaultProviderRegistry;
}

/**
 * The current state of the provider configuration system.
 *
 * This state is derived from ConfigService + SecureCredentialStore +
 * the provider registry. It is NOT directly persisted; instead, individual
 * pieces are persisted through their respective mechanisms.
 */
export interface ProviderConfigurationState {
  /** Version of this state shape, for future migration. */
  readonly version: number;
  /** Registered provider instances. */
  readonly instances: readonly ProviderInstanceConfig[];
  /** Currently active provider instance ID, or undefined. */
  readonly activeProviderId?: ProviderInstanceId;
  /** Currently active model ID, or undefined. */
  readonly activeModel?: string;
}

/**
 * Result of attempting to set the active provider.
 *
 * When `type` is `"ask"`, the caller (e.g. UI) should prompt the user
 * before changing the active provider.
 */
export type SetActiveProviderResult =
  | { readonly type: "allow"; previous?: ProviderInstanceConfig }
  | { readonly type: "ask"; reason: string; previous?: ProviderInstanceConfig }
  | { readonly type: "deny"; reason: string };

/**
 * Result of attempting to set the active model.
 */
export type SetActiveModelResult =
  | { readonly type: "allow"; previous?: string }
  | { readonly type: "deny"; reason: string };

/**
 * Configuration validation result.
 */
export type ValidateConfigurationResult =
  | { readonly type: "ok"; instanceId: ProviderInstanceId }
  | { readonly type: "invalid"; instanceId: ProviderInstanceId; errors: string[] };

/**
 * Provider configuration service.
 *
 * Responsibilities:
 * - Manage registered provider instances (add/remove/update)
 * - Store/retrieve non-secret configuration via ConfigService
 * - Store/retrieve API credentials via SecureCredentialStore
 * - Track active provider and active model
 * - Validate provider configurations
 * - Test provider connectivity
 *
 * The service does NOT:
 * - Expose raw API keys to the UI
 * - Persist secrets in configuration
 * - Make provider SDK calls directly (delegated to provider factories)
 */
export class ProviderConfigurationService {
  readonly #configService: ConfigService;
  readonly #credentialStore: SecureCredentialStore;
  readonly #registry: DefaultProviderRegistry;
  readonly #logger;

  #state: ProviderConfigurationState;

  /**
   * Creates a provider configuration service.
   *
   * @param options - Must include configService and credentialStore.
   *                  registry is optional; if omitted, a new DefaultProviderRegistry is created.
   */
  constructor(options: ProviderConfigurationServiceOptions) {
    this.#configService = options.configService;
    this.#credentialStore = options.credentialStore;
    this.#registry = options.registry ?? new DefaultProviderRegistry();
    this.#logger = createLogger("provider:config-service");

    // Initialize state from config service + registry
    this.#state = this.#initializeState();
  }

  /** Internal: initialize state from config service and registry. */
  #initializeState(): ProviderConfigurationState {
    const storedConfig = this.#configService.get();

    // Build instances from stored provider config + registry
    const instances: ProviderInstanceConfig[] = [];

    // Check stored provider configuration
    const storedProvider = storedConfig.provider.selectedProviderId
      ? { providerId: storedConfig.provider.selectedProviderId, ...this.#inferInstanceConfigFromConfig(storedConfig) }
      : undefined;

    // Add any registry entries not already in instances
    for (const factory of this.#registry.listDescriptors()) {
      const alreadyExists = instances.some(inst => inst.providerId === factory.id);
      if (!alreadyExists) {
        // Add minimal instance from catalog
        instances.push({
          providerId: factory.id,
          displayName: factory.name,
          kind: factory.kind,
          authentication: factory.authentication,
          enabled: true,
        });
      }
    }

    // If we have a stored selected provider, ensure it's in the list
    if (storedProvider && !instances.some(inst => inst.providerId === storedProvider.providerId)) {
      instances.unshift(storedProvider);
    }

    // Default active provider: first enabled instance, or undefined
    const activeProviderId = instances.find(inst => inst.enabled)?.providerId;

    return {
      version: CONFIG_VERSION,
      instances,
      activeProviderId,
      activeModel: undefined,
    };
  }

  /** Get the current configuration state. */
  getState(): ProviderConfigurationState {
    return { ...this.#state };
  }

  /** Get all registered provider instances. */
  getInstances(): readonly ProviderInstanceConfig[] {
    return this.#state.instances;
  }

  /** Get the currently active provider instance, or undefined. */
  getActiveProvider(): ProviderInstanceConfig | undefined {
    if (!this.#state.activeProviderId) return undefined;
    return this.#state.instances.find(inst => inst.providerId === this.#state.activeProviderId);
  }

  /** Get the currently active model, or undefined. */
  getActiveModel(): string | undefined {
    return this.#state.activeModel;
  }

  /** Check whether a provider instance is registered. */
  hasInstance(instanceId: ProviderInstanceId): boolean {
    return this.#state.instances.some(inst => inst.providerId === instanceId);
  }

  /** Check whether a provider type has any instances. */
  hasProviderType(providerType: ProviderId): boolean {
    return this.#state.instances.some(inst => inst.providerId === providerType);
  }

  /** Check whether the active provider has a credential stored. */
  async hasCredential(instanceId: ProviderInstanceId): Promise<boolean> {
    const reference = this.#credentialReference(instanceId);
    return this.#credentialStore.hasSecret(reference);
  }

  /** The canonical credential reference for a provider instance. */
  #credentialReference(instanceId: ProviderInstanceId): string {
    return `provider:${instanceId}:apiKey`;
  }

  /** Store an API key for a provider instance. */
  async setCredential(instanceId: ProviderInstanceId, apiKey: string): Promise<void> {
    const reference = this.#credentialReference(instanceId);
    await this.#credentialStore.setSecret(reference, apiKey);
    this.#logger.info("provider credential stored", { instanceId });
  }

  /** Retrieve an API key for a provider instance. */
  async getCredential(instanceId: ProviderInstanceId): Promise<string | undefined> {
    const reference = this.#credentialReference(instanceId);
    return this.#credentialStore.getSecret(reference);
  }

  /** Delete an API key for a provider instance. */
  async deleteCredential(instanceId: ProviderInstanceId): Promise<void> {
    const reference = this.#credentialReference(instanceId);
    await this.#credentialStore.deleteSecret(reference);
    this.#logger.info("provider credential deleted", { instanceId });
  }

  /**
   * Add a new provider instance.
   *
   * @param config - Non-secret configuration for the new instance.
   *               providerId must match a registered factory.
   */
  async addInstance(config: Omit<ProviderInstanceConfig, "enabled" | "displayName" | "kind" | "authentication"> & { enabled?: boolean }): Promise<ProviderInstanceConfig> {
    const { providerId, ...rest } = config;

    // Verify provider type is registered
    if (!this.#registry.hasProviderType(providerId)) {
      throw new Error(`Unknown provider type: ${providerId}`);
    }

    // Check for duplicate
    if (this.hasInstance(rest.providerId ?? providerId)) {
      throw new Error(`Provider instance already exists: ${providerId}`);
    }

    // Determine display name
    const descriptor = this.#registry.listDescriptors().find(d => d.id === providerId);
    const displayName = descriptor ? descriptor.name : providerId;
    const kind = descriptor ? descriptor.kind : "cloud";
    const authentication = descriptor ? descriptor.authentication : { kind: "api-key", label: "API key" };

    const instanceId = newProviderInstanceId(providerId, rest.descriptor ?? "default");
    const enabled = rest.enabled !== false; // default to enabled

    const instance: ProviderInstanceConfig = {
      providerId,
      displayName,
      kind,
      authentication,
      model: rest.model,
      enabled,
    };

    // Persist non-secret config
    await this.#persistConfig(instance);

    // Update state
    this.#state = {
      ...this.#state,
      instances: [...this.#state.instances, instance],
      activeProviderId: this.#state.activeProviderId ?? instanceId,
    };

    this.#logger.info("provider instance added", { instanceId, providerId });
    return instance;
  }

  /**
   * Update an existing provider instance.
   *
   * Only non-secret fields may be updated. Credentials require separate
   * setCredential/deleteCredential calls.
   */
  async updateInstance(instanceId: ProviderInstanceId, patches: Partial<ProviderInstanceConfig>): Promise<ProviderInstanceConfig> {
    const index = this.#state.instances.findIndex(inst => inst.providerId === instanceId);
    if (index === -1) {
      throw new Error(`Provider instance not found: ${instanceId}`);
    }

    const existing = this.#state.instances[index];
    const updated = { ...existing, ...patches } as ProviderInstanceConfig;

    // Persist non-secret config changes
    await this.#persistConfig(updated);

    // Update state
    this.#state = {
      ...this.#state,
      instances: [
        ...this.#state.instances.slice(0, index),
        updated,
        ...this.#state.instances.slice(index + 1),
      ],
    };

    this.#logger.info("provider instance updated", { instanceId });
    return updated;
  }

  /**
   * Remove a provider instance.
   *
   * - Removes from the in-memory registry
   * - Removes its non-secret configuration
   * - Removes its credential from the secure store
   * - If it was the active provider, clears active state
   */
  async removeInstance(instanceId: ProviderInstanceId): Promise<void> {
    // Remove credential from secure store
    await this.deleteCredential(instanceId);

    // Remove from state
    const index = this.#state.instances.findIndex(inst => inst.providerId === instanceId);
    if (index === -1) {
      this.#logger.warn("attempted to remove non-existent provider instance", { instanceId });
      return;
    }

    this.#state = {
      ...this.#state,
      instances: this.#state.instances.filter(inst => inst.providerId !== instanceId),
    };

    // If we removed the active provider, clear active state
    if (this.#state.activeProviderId === instanceId) {
      this.#state = {
        ...this.#state,
        activeProviderId: undefined,
        activeModel: undefined,
      };
    }

    // Persist updated config (without the removed instance)
    await this.#persistConfigFromState();

    this.#logger.info("provider instance removed", { instanceId });
  }

  /**
   * Set the active provider.
   *
   * The permission system may intercept this. The caller should check the
   * returned result type before committing the change.
   */
  async setActiveProvider(instanceId: ProviderInstanceId): Promise<SetActiveProviderResult> {
    const instance = this.#state.instances.find(inst => inst.providerId === instanceId);
    if (!instance) {
      return { type: "deny", reason: `Provider instance not found: ${instanceId}` };
    }

    // If the instance has no credential, ask the user
    const hasCred = await this.hasCredential(instanceId);
    if (!hasCred) {
      return {
        type: "ask",
        reason: `No API key configured for ${instance.displayName}. Add one to enable.`,
        previous: this.#state.activeProviderId ? this.#state.instances.find(inst => inst.providerId === this.#state.activeProviderId) : undefined,
      };
    }

    // Check permission level - SAFE tools may auto-allow, MODERATE/DANGEROUS ask
    // For now, auto-allow changing active provider (this can be refined later)
    const previous = this.#state.activeProviderId
      ? this.#state.instances.find(inst => inst.providerId === this.#state.activeProviderId)
      : undefined;

    this.#state = {
      ...this.#state,
      activeProviderId: instanceId,
    };

    // Persist the new active provider config
    await this.#persistConfigFromState();

    return { type: "allow", previous };
  }

  /**
   * Set the active model for the current provider.
   */
  async setActiveModel(modelId: string): Promise<SetActiveModelResult> {
    const activeProvider = this.getActiveProvider();
    if (!activeProvider) {
      return { type: "deny", reason: "No active provider selected" };
    }

    // Verify the model is supported by this provider (basic check)
    // In a full implementation, each provider would validate its models
    // For now, accept any model string

    this.#state = {
      ...this.#state,
      activeModel: modelId,
    };

    // Persist the new active model
    await this.#persistConfigFromState();

    return { type: "allow" };
  }

  /**
   * Validate a provider instance's configuration.
   *
   * Checks:
   * - Provider type is registered
   * - Required fields are present
   * - Model is supported (basic check)
   */
  validateInstance(instanceId: ProviderInstanceId): ValidateConfigurationResult {
    const instance = this.#state.instances.find(inst => inst.providerId === instanceId);
    if (!instance) {
      return { type: "invalid", instanceId, errors: ["Provider instance not found"] };
    }

    const errors: string[] = [];

    // Check that provider type is registered
    if (!this.#registry.hasProviderType(instance.providerId)) {
      errors.push(`Provider type "${instance.providerId}" is not registered`);
    }

    // Check authentication
    if (instance.authentication.kind === "api-key" && !instance.model) {
      errors.push("A model must be selected for API-key authenticated providers");
    }

    // If there are errors, return them
    if (errors.length > 0) {
      return { type: "invalid", instanceId, errors };
    }

    return { type: "ok", instanceId };
  }

  /**
   * Test connection to a provider.
   *
   * This attempts a lightweight connection test. The exact behavior depends
   * on the provider implementation. For now, this is a framework method.
   *
   * @returns A result indicating success or failure with a human-readable message.
   */
  async testConnection(instanceId: ProviderInstanceId): Promise<{ type: "success" | "failure"; message: string }> {
    const instance = this.#state.instances.find(inst => inst.providerId === instanceId);
    if (!instance) {
      return { type: "failure", message: `Provider instance not found: ${instanceId}` };
    }

    // Check that we have a credential
    const hasCred = await this.hasCredential(instanceId);
    if (!hasCred) {
      return { type: "failure", message: `No API key configured for ${instance.displayName}` };
    }

    // TODO: Implement actual connection test per provider
    // For now, return a placeholder that indicates the infrastructure is set up
    return {
      type: "failure",
      message: `Connection testing not yet implemented for ${instance.displayName}. Configure and save, then test in a future module.`,
    };
  }

  /** Persist the current non-secret configuration to ConfigService. */
  async #persistConfig(instance: ProviderInstanceConfig): Promise<void> {
    const current = this.#configService.get();

    // Build provider config fragment - NEVER include API keys
    const providerFragment = {
      selectedProviderId: instance.providerId,
      selectedModelId: instance.model,
    };

    // Merge with existing and persist
    const updated = { ...current, provider: providerFragment };
    await this.#configService.save(updated);
  }

  /** Persist the full current state (active provider/model) to ConfigService. */
  async #persistConfigFromState(): Promise<void> {
    const current = this.#configService.get();

    const activeProvider = this.getActiveProvider();
    const providerFragment: { selectedProviderId?: string; selectedModelId?: string } = {};

    if (activeProvider) {
      providerFragment.selectedProviderId = activeProvider.providerId;
      providerFragment.selectedModelId = activeProvider.model;
    }

    const updated = { ...current, provider: { ...current.provider, ...providerFragment } };
    await this.#configService.save(updated);
  }
}