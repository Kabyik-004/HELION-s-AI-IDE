import type { ProviderDescriptor, ProviderId } from "./provider-descriptor";
import type { ProviderRegistry } from "./provider";

const BASE_CAPABILITIES = ["chat", "streaming", "tools"] as const;

/**
 * Static metadata for the providers ForgeAI intends to support.
 *
 * IMPORTANT: this catalogue contains **descriptors only**. It lets the settings UI present
 * the full roadmap of providers (and their authentication requirements) today, without
 * shipping an adapter that pretends to work. `DefaultProviderRegistry` stays empty until
 * Module 1 registers real factories.
 *
 * TODO(module-1): add a `ProviderFactory` per provider and register it in the registry.
 * The UI reads descriptors from a registry first, falling back to this catalogue, so nothing
 * here needs to change when adapters land.
 */
export const PROVIDER_CATALOG: readonly ProviderDescriptor[] = [
  {
    id: "openai",
    name: "OpenAI",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "OpenAI API key",
      documentationUrl: "https://platform.openai.com/api-keys",
    },
    capabilities: [...BASE_CAPABILITIES, "vision", "embeddings", "reasoning"],
    homepage: "https://openai.com",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "Anthropic API key",
      documentationUrl: "https://console.anthropic.com/settings/keys",
    },
    capabilities: [...BASE_CAPABILITIES, "vision", "reasoning"],
    homepage: "https://www.anthropic.com",
    defaultBaseUrl: "https://api.anthropic.com",
  },
  {
    id: "google",
    name: "Google Gemini",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "Google AI Studio API key",
      documentationUrl: "https://aistudio.google.com/app/apikey",
    },
    capabilities: [...BASE_CAPABILITIES, "vision", "embeddings", "reasoning"],
    homepage: "https://ai.google.dev",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "OpenRouter API key",
      documentationUrl: "https://openrouter.ai/keys",
    },
    capabilities: [...BASE_CAPABILITIES, "vision"],
    homepage: "https://openrouter.ai",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
  },
  {
    id: "groq",
    name: "Groq",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "Groq API key",
      documentationUrl: "https://console.groq.com/keys",
    },
    capabilities: [...BASE_CAPABILITIES],
    homepage: "https://groq.com",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
  },
  {
    id: "mistral",
    name: "Mistral",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "Mistral API key",
      documentationUrl: "https://console.mistral.ai/api-keys/",
    },
    capabilities: [...BASE_CAPABILITIES, "embeddings"],
    homepage: "https://mistral.ai",
    defaultBaseUrl: "https://api.mistral.ai/v1",
  },
  {
    id: "ollama",
    name: "Ollama (local)",
    kind: "local",
    authentication: {
      kind: "none",
      label: "No key required (runs locally)",
      documentationUrl: "https://ollama.com",
    },
    capabilities: [...BASE_CAPABILITIES],
    homepage: "https://ollama.com",
    defaultBaseUrl: "http://127.0.0.1:11434",
  },
  {
    id: "custom-openai-compatible",
    name: "Custom OpenAI-compatible endpoint",
    kind: "openai-compatible",
    authentication: {
      kind: "api-key",
      label: "Endpoint API key (optional)",
    },
    capabilities: [...BASE_CAPABILITIES],
  },
];

/** Finds a catalogue entry by id. */
export function findProviderDescriptor(id: ProviderId): ProviderDescriptor | undefined {
  return PROVIDER_CATALOG.find((descriptor) => descriptor.id === id);
}

/**
 * The full list of providers to show in the UI.
 *
 * Registered providers (real adapters, once they exist) take precedence over the static
 * catalogue, so adding an adapter automatically upgrades the entry without any UI change.
 * The UI therefore never needs to know whether a provider is implemented yet.
 */
export function collectProviderDescriptors(registry: ProviderRegistry): readonly ProviderDescriptor[] {
  const registered = registry.listDescriptors();
  const registeredIds = new Set(registered.map((descriptor) => descriptor.id));
  return [...registered, ...PROVIDER_CATALOG.filter((descriptor) => !registeredIds.has(descriptor.id))];
}
