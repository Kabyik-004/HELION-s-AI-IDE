import type { ContextItem, ContextItemKind } from "./context-item";

/** What the caller is looking for. Providers may ignore fields they do not understand. */
export interface ContextQuery {
  readonly text?: string;
  /** Project-relative paths the caller already cares about (open file, selection, ...). */
  readonly paths?: readonly string[];
  readonly kinds?: readonly ContextItemKind[];
  readonly maxItems?: number;
}

export interface ContextCollectionOptions {
  readonly projectRoot: string;
  readonly maxItems: number;
  readonly signal?: AbortSignal;
}

/**
 * A source of context.
 *
 * Examples planned for Module 6: the project tree, a file-content reader, a symbol index, the
 * git diff, and an explicit "user attached this file" provider. Because each is a separate
 * `ContextProvider`, the engine needs no knowledge of any of them.
 *
 * TODO(module-6): implement project-tree, file, symbol and git context providers.
 */
export interface ContextProvider {
  readonly id: string;
  readonly description: string;
  /** Cheap check so the engine can skip providers that cannot answer a query. */
  supports(query: ContextQuery): boolean;
  collect(query: ContextQuery, options: ContextCollectionOptions): Promise<readonly ContextItem[]>;
}
