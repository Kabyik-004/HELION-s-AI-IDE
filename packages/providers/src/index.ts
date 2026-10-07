/**
 * @forgeai/providers
 *
 * The provider abstraction plus the non-secret catalogue of providers ForgeAI intends to
 * support.
 *
 * This package deliberately ships **contracts and metadata only** — `Provider`,
 * `ProviderFactory`, `ProviderRegistry`, the chat vocabulary and `PROVIDER_CATALOG`. The
 * registry stays empty until real adapters are registered, so no fake implementation can
 * pretend to work. Concrete adapters live in the application layer
 * (`apps/desktop/src/features/ai-providers`), which keeps provider-specific code out of the
 * shared packages and out of the UI.
 */

export * from "./provider-descriptor";
export * from "./provider";
export * from "./provider-error";
export * from "./provider-registry";
export * from "./catalog";
export * from "./model";
export * from "./chat";
