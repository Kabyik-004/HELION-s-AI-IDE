/**
 * @forgeai/providers
 *
 * The provider-neutral contract for talking to AI models.
 *
 * Module 0 ships the vocabulary (`Provider`, `ChatRequest`, `ChatChunk`, `ModelInfo`, ...), a
 * registry for factories, and a metadata catalogue of the providers ForgeAI plans to support.
 * It ships **no adapters** — those are Module 1. The UI is built against `ProviderDescriptor`,
 * so connecting a real provider later requires no UI changes.
 *
 * NOTE: this package imports only the `JsonSchema` *type* from `@forgeai/tools` (tool schemas
 * are what models are given). There is no runtime dependency on the tools package.
 */

export * from "./provider-descriptor";
export * from "./model";
export * from "./chat";
export * from "./provider";
export * from "./provider-registry";
export * from "./catalog";
