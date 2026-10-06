import { estimateTokens } from "./context-item";
import type { ContextItem } from "./context-item";
import type { ContextProvider, ContextQuery } from "./context-provider";

/** A materialised view of the project, ready to be handed to a model. */
export interface ContextSnapshot {
  readonly projectRoot: string;
  readonly items: readonly ContextItem[];
  readonly createdAt: number;
  readonly estimatedTokens: number;
}

export interface BuildContextOptions {
  readonly maxItems?: number;
  readonly signal?: AbortSignal;
}

/**
 * Turns "the project + a question" into a bounded set of context items.
 *
 * The engine knows nothing about *how* context is discovered. It fans out to registered
 * providers and merges their results, which is what keeps context sources independently
 * replaceable.
 */
export interface ContextEngine {
  register(provider: ContextProvider): void;
  unregister(providerId: string): void;
  build(projectRoot: string, query?: ContextQuery, options?: BuildContextOptions): Promise<ContextSnapshot>;
}

/**
 * Default engine: fan out to every supporting provider, merge, de-duplicate by item id, and
 * stop at the requested item budget.
 *
 * This is a real, working implementation. With no providers registered it returns an empty
 * snapshot, which is the honest answer rather than a fabricated one.
 */
export class DefaultContextEngine implements ContextEngine {
  readonly #providers = new Map<string, ContextProvider>();
  readonly #defaultMaxItems: number;

  constructor(options: { readonly defaultMaxItems?: number } = {}) {
    this.#defaultMaxItems = options.defaultMaxItems ?? 50;
  }

  register(provider: ContextProvider): void {
    this.#providers.set(provider.id, provider);
  }

  unregister(providerId: string): void {
    this.#providers.delete(providerId);
  }

  async build(
    projectRoot: string,
    query: ContextQuery = {},
    options: BuildContextOptions = {},
  ): Promise<ContextSnapshot> {
    const maxItems = options.maxItems ?? query.maxItems ?? this.#defaultMaxItems;
    const providers = [...this.#providers.values()].filter((provider) => provider.supports(query));

    const collected = await Promise.all(
      providers.map((provider) =>
        provider.collect(query, { projectRoot, maxItems, signal: options.signal }),
      ),
    );

    const items: ContextItem[] = [];
    const seen = new Set<string>();
    for (const batch of collected) {
      for (const item of batch) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
        if (items.length >= maxItems) break;
      }
      if (items.length >= maxItems) break;
    }

    return {
      projectRoot,
      items,
      createdAt: Date.now(),
      estimatedTokens: items.reduce((total, item) => total + (item.estimatedTokens ?? 0), 0),
    };
  }
}

/** Convenience helper for callers that just want to size a string budget. */
export { estimateTokens };
