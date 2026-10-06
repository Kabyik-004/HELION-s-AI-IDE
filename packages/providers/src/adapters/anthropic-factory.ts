import type { Provider, ProviderFactory, CreateProviderOptions } from "./provider";
import type { CredentialStorePort } from "@forgeai/shared";

import { AnthropicAdapter } from "./anthropic";

/** Factory for creating Anthropic provider instances. */
export class AnthropicFactory implements ProviderFactory {
  readonly descriptor: import("./provider-descriptor").ProviderDescriptor = {
    id: "anthropic",
    name: "Anthropic",
    kind: "cloud",
    authentication: {
      kind: "api-key",
      label: "Anthropic API key",
      documentationUrl: "https://console.anthropic.com/settings/keys",
    },
    capabilities: ["chat", "streaming", "tools", "vision", "reasoning"],
    homepage: "https://www.anthropic.com",
    defaultBaseUrl: "https://api.anthropic.com",
  };

  create(options: CreateProviderOptions): Provider {
    return new AnthropicAdapter(this.descriptor, options.credentials, options.credentialId, options.logger);
  }
}