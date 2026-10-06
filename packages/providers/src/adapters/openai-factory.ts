import type { Provider, ProviderFactory, CreateProviderOptions } from "./provider";
import type { CredentialStorePort } from "@forgeai/shared";

import { OpenAIAdapter } from "./openai";

/** Factory for creating OpenAI provider instances. */
export class OpenAIFactory implements ProviderFactory {
  readonly descriptor: import("./provider-descriptor").ProviderDescriptor = {
    id: "openai",
    name: "OpenAI",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "OpenAI API key",
      documentationUrl: "https://platform.openai.com/api-keys",
    },
    capabilities: ["chat", "streaming", "tools", "vision", "embeddings", "reasoning"],
    homepage: "https://openai.com",
    defaultBaseUrl: "https://api.openai.com/v1",
  };

  create(options: CreateProviderOptions): Provider {
    // The factory creates the provider with the credential store and its ID.
    // The provider will lazily fetch its API key when making network calls.
    return new OpenAIAdapter(this.descriptor, options.credentials, options.credentialId, options.logger);
  }
}