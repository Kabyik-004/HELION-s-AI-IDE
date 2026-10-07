import { collectProviderDescriptors } from "@forgeai/providers";
import type { ProviderDescriptor, ProviderRegistry } from "@forgeai/providers";
import { createLogger } from "@forgeai/shared";
import type { Logger } from "@forgeai/shared";
import { providerCredentialId } from "@forgeai/storage";
import type {
  ConfigService,
  ForgeAIConfig,
  ProviderInstanceConfig,
  SecureCredentialStore,
} from "@forgeai/storage";

import type { ConnectionTester, ConnectionTestResult } from "./connectionTester";
import { makeInstanceId, validateProviderDraft, type ProviderDraft, type ValidationIssue, type ValidationResult } from "./providerValidation";

export type { ProviderDraft, ValidationIssue, ValidationResult } from "./providerValidation";

export interface ProviderServiceOptions {
  readonly config: ConfigService;
  readonly credentialStore: SecureCredentialStore;
  readonly registry: ProviderRegistry;
  readonly connectionTester: ConnectionTester;
  readonly logger?: Logger;
}

export interface UpdateProviderPatch {
  readonly displayName?: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly enabled?: boolean;
}

/** Thrown when a draft or update fails service-level validation. */
export class ProviderValidationError extends Error {
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super(issues.map((issue) => issue.message).join(" "));
    this.name = "ProviderValidationError";
    this.issues = issues;
  }
}

function normalize(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/**
 * The one owner of provider configuration.
 *
 * It is the only code that writes `config.provider`, and the only code that talks to the secure
 * credential store on behalf of providers. That split is the security boundary:
 *
 *   - `ConfigService` holds **non-secret** configuration (ids, names, endpoints, models, enabled).
 *   - `SecureCredentialStore` holds **secrets** under `provider:<instanceId>:apiKey`.
 *
 * Nothing here returns a key to the caller, and no mutation copies a key into configuration.
 */
export class ProviderService {
  readonly #config: ConfigService;
  readonly #credentialStore: SecureCredentialStore;
  readonly #registry: ProviderRegistry;
  readonly #tester: ConnectionTester;
  readonly #logger: Logger;

  constructor(options: ProviderServiceOptions) {
    this.#config = options.config;
    this.#credentialStore = options.credentialStore;
    this.#registry = options.registry;
    this.#tester = options.connectionTester;
    this.#logger = options.logger ?? createLogger("providers");
  }

  /* ----------------------------------------------------------------------------- catalogue -- */

  /** Every provider ForgeAI knows about: registered adapters first, then catalogue metadata. */
  descriptors(): readonly ProviderDescriptor[] {
    return collectProviderDescriptors(this.#registry);
  }

  descriptorFor(providerType: string): ProviderDescriptor | undefined {
    return this.descriptors().find((descriptor) => descriptor.id === providerType);
  }

  /* ----------------------------------------------------------------------------- instances -- */

  listInstances(): readonly ProviderInstanceConfig[] {
    return this.#config.get().provider.instances;
  }

  getInstance(id: string): ProviderInstanceConfig | undefined {
    return this.listInstances().find((instance) => instance.id === id);
  }

  activeInstance(): ProviderInstanceConfig | undefined {
    const id = this.#config.get().provider.selectedProviderId;
    return id === undefined ? undefined : this.getInstance(id);
  }

  activeModel(): string | undefined {
    return this.activeInstance()?.model;
  }

  /* ---------------------------------------------------------------------------- credentials -- */

  /** The opaque credential id for an instance. Never a secret, safe to store and log. */
  credentialReference(instanceId: string): string {
    return providerCredentialId(instanceId);
  }

  hasCredential(instanceId: string): Promise<boolean> {
    return this.#credentialStore.hasSecret(this.credentialReference(instanceId));
  }

  /**
   * Refuses empty keys instead of storing a meaningless credential.
   *
   * The value is trimmed and never logged.
   */
  async setCredential(instanceId: string, secret: string): Promise<void> {
    const value = secret.trim();
    if (value.length === 0) throw new Error("Enter an API key.");
    await this.#credentialStore.setSecret(this.credentialReference(instanceId), value);
    this.#logger.info("provider credential stored", { instanceId });
  }

  /** Removes only the credential; the provider configuration is untouched. */
  async removeCredential(instanceId: string): Promise<void> {
    await this.#credentialStore.deleteSecret(this.credentialReference(instanceId));
    this.#logger.info("provider credential removed", { instanceId });
  }

  /* ----------------------------------------------------------------------------- validation -- */

  /** Re-checks a draft. The UI validates too, but the service never trusts it. */
  validate(draft: ProviderDraft, options: { readonly editingId?: string } = {}): ValidationResult {
    return validateProviderDraft(draft, {
      descriptors: this.descriptors(),
      existingIds: this.listInstances().map((instance) => instance.id),
      editingId: options.editingId,
    });
  }

  /* ------------------------------------------------------------------------------ mutations -- */

  /**
   * Adds a provider instance.
   *
   * The credential is written **before** the configuration, so a failed key write never leaves a
   * configured provider that cannot authenticate.
   */
  async addInstance(draft: ProviderDraft, credential?: string): Promise<ProviderInstanceConfig> {
    const result = this.validate(draft);
    if (!result.ok) throw new ProviderValidationError(result.issues);

    const descriptor = this.descriptorFor(draft.providerType);
    if (descriptor === undefined) {
      throw new ProviderValidationError([{ field: "providerType", message: "Choose a provider." }]);
    }

    const requiresKey = descriptor.authentication.kind === "api-key";
    if (requiresKey && (credential === undefined || credential.trim().length === 0)) {
      throw new ProviderValidationError([{ field: "credential", message: "Enter an API key." }]);
    }

    const current = this.#config.get().provider;
    const id = makeInstanceId(draft.providerType, draft.displayName, current.instances.map((instance) => instance.id));

    if (requiresKey && credential !== undefined) {
      await this.setCredential(id, credential);
    }

    const instance: ProviderInstanceConfig = {
      id,
      providerType: draft.providerType,
      displayName: draft.displayName.trim(),
      enabled: draft.enabled ?? true,
      ...(normalize(draft.baseUrl) === undefined ? {} : { baseUrl: normalize(draft.baseUrl) }),
      ...(normalize(draft.model) === undefined ? {} : { model: normalize(draft.model) }),
    };

    await this.#saveProvider({
      ...current,
      instances: [...current.instances, instance],
      selectedProviderId: current.selectedProviderId ?? instance.id,
    });
    this.#logger.info("provider instance added", { instanceId: id, providerType: instance.providerType });
    return instance;
  }

  /** Updates non-secret fields only. Credentials change through `setCredential`/`removeCredential`. */
  async updateInstance(id: string, patch: UpdateProviderPatch): Promise<ProviderInstanceConfig> {
    const existing = this.getInstance(id);
    if (existing === undefined) throw new Error("That provider is not configured.");

    const draft: ProviderDraft = {
      providerType: existing.providerType,
      displayName: patch.displayName ?? existing.displayName,
      baseUrl: patch.baseUrl ?? existing.baseUrl,
      model: patch.model ?? existing.model,
    };
    const result = this.validate(draft, { editingId: id });
    if (!result.ok) throw new ProviderValidationError(result.issues);

    const baseUrl = normalize(draft.baseUrl);
    const model = normalize(draft.model);
    const updated: ProviderInstanceConfig = {
      id,
      providerType: existing.providerType,
      displayName: draft.displayName.trim(),
      enabled: patch.enabled ?? existing.enabled,
      ...(baseUrl === undefined ? {} : { baseUrl }),
      ...(model === undefined ? {} : { model }),
    };

    const current = this.#config.get().provider;
    await this.#saveProvider({
      ...current,
      instances: current.instances.map((instance) => (instance.id === id ? updated : instance)),
    });
    this.#logger.info("provider instance updated", { instanceId: id });
    return updated;
  }

  /** Removes an instance **and** its credential, so no orphan secret is left behind. */
  async removeInstance(id: string): Promise<void> {
    const current = this.#config.get().provider;
    await this.removeCredential(id);

    const instances = current.instances.filter((instance) => instance.id !== id);
    const selected = current.selectedProviderId;
    const next: ForgeAIConfig["provider"] =
      selected !== undefined && selected !== id ? { instances, selectedProviderId: selected } : { instances };
    await this.#saveProvider(next);
    this.#logger.info("provider instance removed", { instanceId: id });
  }

  /** Makes an instance active. Disabled instances are refused. */
  async setActive(id: string): Promise<ProviderInstanceConfig> {
    const instance = this.getInstance(id);
    if (instance === undefined) throw new Error("That provider is not configured.");
    if (!instance.enabled) throw new Error(`“${instance.displayName}” is disabled.`);
    await this.#saveProvider({ ...this.#config.get().provider, selectedProviderId: id });
    this.#logger.info("provider activated", { instanceId: id });
    return instance;
  }

  /** Sets (or clears) the model for one instance. */
  async setModel(id: string, model: string | undefined): Promise<ProviderInstanceConfig> {
    return this.updateInstance(id, { model });
  }

  /* --------------------------------------------------------------------------------- probes -- */

  /** Probes the real endpoint using the stored credential. Never returns the key. */
  async testConnection(id: string): Promise<ConnectionTestResult> {
    const instance = this.getInstance(id);
    if (instance === undefined) return { ok: false, message: "That provider is not configured." };

    const descriptor = this.descriptorFor(instance.providerType);
    const baseUrl = instance.baseUrl ?? descriptor?.defaultBaseUrl;
    if (baseUrl === undefined) {
      return { ok: false, message: `${instance.displayName} has no endpoint configured.` };
    }

    return this.#tester.test({
      providerType: instance.providerType,
      providerName: instance.displayName,
      baseUrl,
      credentialId: this.credentialReference(id),
    });
  }

  /* -------------------------------------------------------------------------------- helpers -- */

  /** Writes the provider section wholesale, so a cleared field is genuinely cleared. */
  async #saveProvider(provider: ForgeAIConfig["provider"]): Promise<void> {
    await this.#config.save({ ...this.#config.get(), provider });
  }
}
