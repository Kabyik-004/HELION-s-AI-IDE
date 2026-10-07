import { createLogger } from "@forgeai/shared";
import type { Logger } from "@forgeai/shared";
import { PROVIDER_CATALOG } from "@forgeai/providers";
import type {
  AnyProviderFactory,
  CreateProviderOptions,
  Provider,
  ProviderDescriptor,
  ProviderFactory,
  ProviderRegistry,
} from "@forgeai/providers";

import { OpenAICompatibleAdapter } from "./adapters/openaiCompatible";

/** Non-secret configuration an OpenAI-compatible adapter needs. */
export interface OpenAICompatibleConfig {
  /** Endpoint override. Falls back to the descriptor's default. */
  readonly baseUrl?: string;
}

/**
 * Builds a provider client for any endpoint that speaks the OpenAI request/response format.
 *
 * The adapter is constructed **without a key**: it resolves the credential lazily from the store
 * on each request, so a provider can be created, configured and tested before a key is entered.
 * One factory class covers every compatible provider — the descriptor is data, supplied per type.
 */
export class OpenAICompatibleProviderFactory implements ProviderFactory<OpenAICompatibleConfig> {
  readonly descriptor: ProviderDescriptor;

  constructor(descriptor: ProviderDescriptor) {
    this.descriptor = descriptor;
  }

  create(options: CreateProviderOptions<OpenAICompatibleConfig>): Provider {
    const baseUrl = options.config.baseUrl ?? this.descriptor.defaultBaseUrl;
    if (baseUrl === undefined || baseUrl.length === 0) {
      throw new Error(`The ${this.descriptor.name} provider needs a base URL.`);
    }
    const logger: Logger = options.logger ?? createLogger("providers");
    return new OpenAICompatibleAdapter(this.descriptor, baseUrl, options.credentials, options.credentialId, logger);
  }
}

/**
 * The provider types ForgeAI can construct a client for today.
 *
 * Anthropic and Google Gemini appear in the catalogue so they can be configured, have their keys
 * stored, and be connection-tested, but their request formats differ from the OpenAI shape. Their
 * adapters are deliberately left to the module that first needs them for chat, rather than being
 * guessed here.
 */
const OPENAI_COMPATIBLE_TYPES: readonly string[] = [
  "openai",
  "openrouter",
  "groq",
  "mistral",
  "ollama",
  "custom-openai-compatible",
];

/** Registers every built-in provider factory the registry does not already have. */
export function registerBuiltInProviders(registry: ProviderRegistry): void {
  for (const descriptor of PROVIDER_CATALOG) {
    if (!OPENAI_COMPATIBLE_TYPES.includes(descriptor.id)) continue;
    if (registry.has(descriptor.id)) continue;
    const factory: AnyProviderFactory = new OpenAICompatibleProviderFactory(descriptor);
    registry.register(factory);
  }
}
