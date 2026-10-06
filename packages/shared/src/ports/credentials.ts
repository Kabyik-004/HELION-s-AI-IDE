/**
 * A pointer to a secret held in the operating system's credential store.
 *
 * The value itself is never part of configuration, never serialized to disk, and never
 * logged. Only the reference travels through the application.
 */
export interface SecretReference {
  /** Stable, non-secret identifier, for example `provider:openai:apiKey`. */
  readonly id: string;
}

/**
 * Access to secrets.
 *
 * TODO(module-3): back this with the OS keychain
 * (Windows Credential Manager, macOS Keychain, Linux Secret Service) via Rust.
 */
export interface CredentialStorePort {
  get(reference: SecretReference): Promise<string | undefined>;
  set(reference: SecretReference, secret: string): Promise<void>;
  delete(reference: SecretReference): Promise<void>;
  has(reference: SecretReference): Promise<boolean>;
}
