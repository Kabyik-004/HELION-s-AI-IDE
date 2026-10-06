/**
 * @forgeai/providers
 *
 * Provider abstraction, registry, catalog and initial implementations.
 *
 * Module 3: AI Provider & API Key System.
 *
 * This package is the foundation for all AI functionality in ForgeAI.
 * It should NOT be depended on by the UI for provider-specific logic —
 * only by the provider service and the settings UI.
 */

export * from "./core";
export * from "./core/registry";
export * from "./core/provider-configuration-service";
export * from "./catalog";
export * from "./model";