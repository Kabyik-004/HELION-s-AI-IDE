import { invoke } from "@tauri-apps/api/core";

import { FileSystemError } from "@forgeai/shared";
import type { CredentialStorePort, SecretReference } from "@forgeai/shared";

/**
 * `SecureCredentialStore` backed by the OS keychain via Tauri commands.
 *
 * This is the production implementation that uses the OS keychain (Windows Credential Manager,
/// macOS Keychain, Linux Secret Service) via the Rust `keyring` crate.
export class TauriCredentialStore {
  async setSecret(id: string, secret: string): Promise<void> {
    try {
      await invoke("set_secret", { id, secret });
    } catch (cause) {
      throw FileSystemError.from(cause);
    }
  }

  async getSecret(id: string): Promise<string | undefined> {
    try {
      return await invoke("get_secret", { id });
    } catch (cause) {
      const error = FileSystemError.from(cause);
      if (error.isNotFound) return undefined;
      throw error;
    }
  }

  async deleteSecret(id: string): Promise<void> {
    try {
      await invoke("delete_secret", { id });
    } catch (cause) {
      throw FileSystemError.from(cause);
    }
  }

  async hasSecret(id: string): Promise<boolean> {
    try {
      return await invoke("has_secret", { id });
    } catch (cause) {
      throw FileSystemError.from(cause);
    }
  }
}

/**
 * Adapts a `SecureCredentialStore` to the `CredentialStorePort` that provider adapters use.
 */
export class CredentialStoreAdapter implements CredentialStorePort {
  readonly #store: { setSecret(id: string, secret: string): Promise<void>; getSecret(id: string): Promise<string | undefined>; deleteSecret(id: string): Promise<void>; hasSecret(id: string): Promise<boolean> };

  constructor(store: { setSecret(id: string, secret: string): Promise<void>; getSecret(id: string): Promise<string | undefined>; deleteSecret(id: string): Promise<void>; hasSecret(id: string): Promise<boolean> }) {
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