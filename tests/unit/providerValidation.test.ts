import { describe, expect, it } from "vitest";

import { PROVIDER_CATALOG } from "@forgeai/providers";

import {
  makeInstanceId,
  slugify,
  validateProviderDraft,
} from "../../apps/desktop/src/features/providers/providerValidation";

const options = { descriptors: PROVIDER_CATALOG, existingIds: [] as string[] };

describe("validateProviderDraft", () => {
  it("accepts a well-formed draft", () => {
    expect(validateProviderDraft({ providerType: "openai", displayName: "OpenAI" }, options).ok).toBe(true);
  });

  it("accepts an optional, valid base URL", () => {
    const result = validateProviderDraft(
      { providerType: "openai", displayName: "OpenAI", baseUrl: "https://example.test/v1" },
      options,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects an empty display name", () => {
    const result = validateProviderDraft({ providerType: "openai", displayName: "   " }, options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toContain("displayName");
  });

  it("rejects an unknown provider type", () => {
    const result = validateProviderDraft({ providerType: "does-not-exist", displayName: "X" }, options);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toContain("providerType");
  });

  it("rejects a malformed base URL", () => {
    const result = validateProviderDraft(
      { providerType: "openai", displayName: "OpenAI", baseUrl: "not a url" },
      options,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toContain("baseUrl");
  });
});

describe("instance ids", () => {
  it("slugifies into a url-safe fragment", () => {
    expect(slugify("OpenAI — Personal")).toBe("openai-personal");
    expect(slugify("   ")).toBe("provider");
  });

  it("builds a unique id, de-duplicating with a suffix", () => {
    expect(makeInstanceId("openai", "OpenAI Personal", [])).toBe("openai-openai-personal");
    expect(makeInstanceId("openai", "OpenAI Personal", ["openai-openai-personal"])).toBe("openai-openai-personal-2");
  });
});
