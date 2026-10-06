import { ForgeError } from "@forgeai/shared";

import type { AnyProviderFactory, ProviderRegistry } from "./provider";
import type { ProviderDescriptor, ProviderId } from "./provider-descriptor";

/**
 * Default in-memory provider registry.
 *
 * This is a real, working registry — it is simply empty until Module 1 registers adapters.
 * `@forgeai/providers`'s `PROVIDER_CATALOG` supplies the metadata the UI needs in the
 * meantime, so the settings screen is useful before any adapter exists.
 */
export class DefaultProviderRegistry implements ProviderRegistry {
  readonly #factories = new Map<ProviderId, AnyProviderFactory>();

  register(factory: AnyProviderFactory): void {
    const id = factory.descriptor.id;
    if (this.#factories.has(id)) {
      throw new ForgeError("INVALID_INPUT", `A provider with id "${id}" is already registered.`);
    }
    this.#factories.set(id, factory);
  }

  get(id: ProviderId): AnyProviderFactory | undefined {
    return this.#factories.get(id);
  }

  has(id: ProviderId): boolean {
    return this.#factories.has(id);
  }

  listDescriptors(): readonly ProviderDescriptor[] {
    return [...this.#factories.values()].map((factory) => factory.descriptor);
  }

  get size(): number {
    return this.#factories.size;
  }
}
