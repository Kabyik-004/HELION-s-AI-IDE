/**
 * @forgeai/storage
 *
 * Two clearly separated concerns:
 *
 *   - `ConfigService` + `KeyValueStore` — non-secret preferences.
 *   - `SecureCredentialStore` — secrets, destined for the OS keychain.
 *
 * The rule for this package: **nothing secret may ever be written to configuration.** Provider
 * adapters receive a `CredentialStorePort` (from `@forgeai/shared`) and look their own key up;
 * the key itself never travels through `ForgeAIConfig`.
 */

export * from "./key-value-store";
export * from "./config";
export * from "./credential-store";
