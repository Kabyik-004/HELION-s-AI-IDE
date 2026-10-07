import { FileSystemError } from "@forgeai/shared";
import type { SecureCredentialStore } from "@forgeai/storage";

import { backend } from "../../infrastructure/ipc/backend";

/**
 * `SecureCredentialStore` backed by the OS keychain (Windows Credential Manager, macOS Keychain,
 * Linux Secret Service) through the Rust `keyring` crate.
 *
 * This is the production implementation used by the desktop app; the browser preview substitutes
 * `InMemoryCredentialStore`. Credentials are application-global (they do not require an open
 * folder) and every call goes through `backend`, which is the only module that speaks Tauri IPC.
 *
 * Nothing here is ever written to configuration: the store holds secrets, `ConfigService` holds
 * preferences, and the two are never mixed.
 */
export class TauriCredentialStore implements SecureCredentialStore {
  async setSecret(id: string, secret: string): Promise<void> {
    await backend.setSecret(id, secret);
  }

  async getSecret(id: string): Promise<string | undefined> {
    try {
      return await backend.getSecret(id);
    } catch (cause) {
      // "There is no such credential" is a normal answer, not a failure.
      if (cause instanceof FileSystemError && cause.isNotFound) return undefined;
      throw cause;
    }
  }

  async hasSecret(id: string): Promise<boolean> {
    return backend.hasSecret(id);
  }

  async deleteSecret(id: string): Promise<void> {
    await backend.deleteSecret(id);
  }
}
