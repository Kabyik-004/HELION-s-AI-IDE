import type { CredentialStorePort, SecretReference } from "@forgeai/shared";

/**
 * Storage for secrets (API keys, tokens).
 *
 * The interface is intentionally tiny. Implementations are expected to delegate to an OS
 * facility, never to a file in the project.
 *
 * TODO(module-1): implement via the OS keychain — Windows Credential Manager, macOS Keychain,
 * or Linux Secret Service — through a Rust `keyring` command.
 */
export interface SecureCredentialStore {
  setSecret(id: string, secret: string): Promise<void>;
  getSecret(id: string): Promise<string | undefined>;
  deleteSecret(id: string): Promise<void>;
  hasSecret(id: string): Promise<boolean>;
}

/**
 * ⚠️ NOT SECURE — development only. ⚠️
 *
 * Secrets are held in memory in plain text and are lost when the process exits. This exists
 * solely so the app can run and the provider settings screen can be exercised before keychain
 * support lands. It must never be selected in a production build.
 */
export class InMemoryCredentialStore implements SecureCredentialStore {
  readonly #secrets = new Map<string, string>();

  async setSecret(id: string, secret: string): Promise<void> {
    this.#secrets.set(id, secret);
  }

  async getSecret(id: string): Promise<string | undefined> {
    return this.#secrets.get(id);
  }

  async deleteSecret(id: string): Promise<void> {
    this.#secrets.delete(id);
  }

  async hasSecret(id: string): Promise<boolean> {
    return this.#secrets.has(id);
  }
}

/**
 * Adapts a `SecureCredentialStore` to the `CredentialStorePort` that provider adapters use.
 *
 * This keeps provider code depending on the small port in `@forgeai/shared` rather than on
 * this package, so providers can be tested with any credential source.
 */
export class CredentialStoreAdapter implements CredentialStorePort {
  readonly #store: SecureCredentialStore;

  constructor(store: SecureCredentialStore) {
    this.#store = store;
  }

  async get(reference: SecretReference): Promise<string | undefined> {
    return this.#store.getSecret(reference.id);
  }

  async set(reference: SecretReference, secret: string): Promise<void> {
    await this.#store.setSecret(reference.id, secret);
  }

  async delete(reference: SecretReference): Promise<void> {
    await this.#store.deleteSecret(reference.id);
  }

  async has(reference: SecretReference): Promise<boolean> {
    return this.#store.hasSecret(reference.id);
  }
}

/** Builds the canonical credential id for a provider's API key. */
export function providerCredentialId(providerId: string): string {
  return `provider:${providerId}:apiKey`;
}
