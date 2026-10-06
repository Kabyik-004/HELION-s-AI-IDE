/**
 * @forgeai/providers/core/registry
 *
 * Provider registry that supports multiple instances per provider type.
 *
 * Convention: provider instances are identified by `ProviderInstanceId`
 * composed as `{providerId}-{descriptor}`, e.g. `openai-personal`, `openai-work`.
 *
 * The registry stores `AnyProviderFactory` entries keyed by instance ID.
 * Each factory knows how to create a `Provider` given config and credential access.
 */

import { newProviderInstanceId } from "./index";
import type { AnyProviderFactory } from "../provider";
import type { ProviderDescriptor } from "../provider-descriptor";
import { ForgeError } from "@forgeai/shared";

/**
 * Registry of provider factories, supporting multiple instances per provider type.
 *
 * Instances are identified by ProviderInstanceId. The same provider type
 * (e.g. "openai") can be registered multiple times with different instance IDs,
 * each with its own configuration and credentials.
 */
export class DefaultProviderRegistry {
  readonly #factories = new Map<string, AnyProviderFactory>();

  /**
   * Register a provider factory for a specific instance.
   *
   * Throws if an instance with the same ID already exists.
   *
   * @param factory The factory to register. Its `descriptor.id` must be a stable
   *                provider type such as "openai". The instance ID is derived from
   *                the factory's descriptor and any additional context.
   */
  register(factory: AnyProviderFactory): string {
    const id = factory.descriptor.id;
    // The factory descriptor.id is the provider type (e.g. "openai").
    // We generate an instance ID based on the provider type.
    // Callers should use newProviderInstanceId if they want custom descriptors.
    const instanceId = newProviderInstanceId(id, factory.descriptor.id);
    if (this.#factories.has(instanceId)) {
      throw new ForgeError(
        "INVALID_INPUT",
        `A provider instance with id "${instanceId}" is already registered.`,
      );
    }
    this.#factories.set(instanceId, factory);
    return instanceId;
  }

  /**
   * Retrieve a registered provider factory by instance ID.
   *
   * @param instanceId The instance ID, e.g. "openai-personal".
   * @returns The factory if found, undefined otherwise.
   */
  get(instanceId: string): AnyProviderFactory | undefined {
    return this.#factories.get(instanceId);
  }

  /**
   * Check whether a provider instance is registered.
   *
   * @param instanceId The instance ID, e.g. "openai-personal".
   * @returns True when a factory is registered for this instance.
   */
  has(instanceId: string): boolean {
    return this.#factories.has(instanceId);
  }

  /**
   * List all registered provider instance descriptors.
   *
   * @returns Readonly array of provider descriptors, each representing a registered instance.
   */
  listDescriptors(): readonly ProviderDescriptor[] {
    return [...this.#factories.values()].map((factory) => factory.descriptor);
  }

  /** The number of registered provider instances. */
  get size(): number {
    return this.#factories.size;
  }

  /** Returns true when at least one instance is registered. */
  get isEmpty(): boolean {
    return this.#factories.size === 0;
  }
}