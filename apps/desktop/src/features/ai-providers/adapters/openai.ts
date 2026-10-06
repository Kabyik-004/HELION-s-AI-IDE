import type { Logger } from "@forgeai/shared";

import { OpenAICompatibleAdapter } from "./openaiCompatible";
import type { ProviderDescriptor } from "@forgeai/providers";

/**
 * OpenAI provider adapter.
 */
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  static readonly descriptor: ProviderDescriptor = {
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

  constructor(apiKey: string, logger: Logger) {
    super(OpenAIAdapter.descriptor, "https://api.openai.com/v1", apiKey, logger);
  }
}