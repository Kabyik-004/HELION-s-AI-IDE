import { describe, expect, it } from "vitest";

import { DefaultProviderRegistry } from "@forgeai/providers";
import { createLogger } from "@forgeai/shared";
import {
  DefaultConfigService,
  InMemoryKeyValueStore,
  type SecureCredentialStore,
} from "@forgeai/storage";

import { registerBuiltInProviders } from "../../apps/desktop/src/features/ai-providers/factories";
import type { ConnectionTester } from "../../apps/desktop/src/features/providers/connectionTester";
import { ProviderService, ProviderValidationError } from "../../apps/desktop/src/features/providers/providerService";

const logger = createLogger("test");

/** An in-memory stand-in for the OS keychain. */
class FakeCredentialStore implements SecureCredentialStore {
  readonly entries = new Map<string, string>();
  async setSecret(id: string, secret: string): Promise<void> {
    this.entries.set(id, secret);
  }
  async getSecret(id: string): Promise<string | undefined> {
    return this.entries.get(id);
  }
  async deleteSecret(id: string): Promise<void> {
    this.entries.delete(id);
  }
  async hasSecret(id: string): Promise<boolean> {
    return this.entries.has(id);
  }
}

const okTester: ConnectionTester = {
  async test(request) {
    return { ok: true, message: `Connected to ${request.providerName}.` };
  },
};

function build(store = new InMemoryKeyValueStore()) {
  const config = new DefaultConfigService({ store, logger });
  const credentialStore = new FakeCredentialStore();
  const registry = new DefaultProviderRegistry();
  registerBuiltInProviders(registry);
  const service = new ProviderService({ config, credentialStore, registry, connectionTester: okTester, logger });
  return { config, credentialStore, service, store };
}

describe("ProviderService", () => {
  it("adds a provider, stores the key separately, and activates it", async () => {
    const { service, credentialStore, config } = build();

    const instance = await service.addInstance(
      { providerType: "openai", displayName: "OpenAI Personal", model: "gpt-4o-mini" },
      "sk-test-123",
    );

    expect(instance.id).toBe("openai-openai-personal");
    expect(await credentialStore.getSecret("provider:openai-openai-personal:apiKey")).toBe("sk-test-123");
    expect(config.get().provider.instances).toHaveLength(1);
    expect(service.activeInstance()?.id).toBe(instance.id);
  });

  it("never writes the key into configuration", async () => {
    const { service, config, store } = build();

    await service.addInstance(
      { providerType: "openai", displayName: "OpenAI", model: "gpt-4o" },
      "TEST_SECRET_DO_NOT_LEAK_123456",
    );

    expect(JSON.stringify(config.get())).not.toContain("TEST_SECRET_DO_NOT_LEAK_123456");
    expect(JSON.stringify(await store.get("forgeai.config"))).not.toContain("TEST_SECRET_DO_NOT_LEAK_123456");
  });

  it("refuses to add an API-key provider without a key", async () => {
    const { service } = build();
    await expect(
      service.addInstance({ providerType: "openai", displayName: "OpenAI" }, "   "),
    ).rejects.toBeInstanceOf(ProviderValidationError);
  });

  it("reports validation issues for a bad draft", () => {
    const { service } = build();
    expect(service.validate({ providerType: "openai", displayName: "  " }).ok).toBe(false);
    expect(service.validate({ providerType: "nope", displayName: "X" }).ok).toBe(false);
    expect(service.validate({ providerType: "openai", displayName: "OpenAI" }).ok).toBe(true);
  });

  it("gives two instances of the same provider distinct ids", async () => {
    const { service } = build();
    const first = await service.addInstance({ providerType: "openai", displayName: "OpenAI" }, "k1");
    const second = await service.addInstance({ providerType: "openai", displayName: "OpenAI" }, "k2");
    expect(first.id).not.toBe(second.id);
  });

  it("removes an instance together with its credential and clears the selection", async () => {
    const { service, credentialStore, config } = build();
    const instance = await service.addInstance({ providerType: "openai", displayName: "OpenAI" }, "sk-1");

    await service.removeInstance(instance.id);

    expect(config.get().provider.instances).toHaveLength(0);
    expect(config.get().provider.selectedProviderId).toBeUndefined();
    expect(await credentialStore.hasSecret(`provider:${instance.id}:apiKey`)).toBe(false);
  });

  it("refuses to activate a disabled instance", async () => {
    const { service } = build();
    const first = await service.addInstance({ providerType: "openai", displayName: "First" }, "k1");
    await service.addInstance({ providerType: "openai", displayName: "Second" }, "k2");

    await service.updateInstance(first.id, { enabled: false });
    await expect(service.setActive(first.id)).rejects.toThrow();
  });

  it("round-trips non-secret configuration through the store", async () => {
    const store = new InMemoryKeyValueStore();
    const first = build(store);
    await first.service.addInstance(
      { providerType: "openai", displayName: "OpenAI", model: "gpt-4o" },
      "sk-1",
    );

    // A second service over the same store, as after a restart.
    const config = new DefaultConfigService({ store, logger });
    await config.load();
    const registry = new DefaultProviderRegistry();
    registerBuiltInProviders(registry);
    const service = new ProviderService({
      config,
      credentialStore: new FakeCredentialStore(),
      registry,
      connectionTester: okTester,
      logger,
    });

    const instances = service.listInstances();
    expect(instances).toHaveLength(1);
    expect(instances[0]?.displayName).toBe("OpenAI");
    expect(instances[0]?.model).toBe("gpt-4o");
  });

  it("tests a connection through the tester without exposing the key", async () => {
    const { service } = build();
    const instance = await service.addInstance({ providerType: "openai", displayName: "OpenAI" }, "sk-secret");

    const result = await service.testConnection(instance.id);

    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sk-secret");
  });

  it("reports an honest failure when the provider has no endpoint", async () => {
    const { service } = build();
    // `custom-openai-compatible` has no default base URL and none was given.
    const instance = await service.addInstance(
      { providerType: "custom-openai-compatible", displayName: "Local" },
      "key",
    );
    const result = await service.testConnection(instance.id);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("no endpoint");
  });
});
