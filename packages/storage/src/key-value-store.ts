/**
 * A tiny asynchronous key/value store.
 *
 * The interface is asynchronous even though the in-memory implementation is not, because real
 * implementations (a JSON file, SQLite, or a Tauri command) will be. Freezing the async shape
 * now means swapping the implementation later cannot break callers.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix?: string): Promise<readonly string[]>;
}

/**
 * In-memory implementation.
 *
 * This is honest about what it is: nothing is written to disk, so configuration is lost when
 * the app exits. It exists so the rest of Module 0 (config service, settings UI) can be built
 * and exercised today.
 *
 * TODO(module-1): add a persisted implementation (JSON file under the app data directory).
 */
export class InMemoryKeyValueStore implements KeyValueStore {
  readonly #entries = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    const value = this.#entries.get(key);
    // Clone on the way out so a caller cannot mutate stored state by accident.
    return value === undefined ? undefined : (structuredClone(value) as T);
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.#entries.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.#entries.delete(key);
  }

  async keys(prefix?: string): Promise<readonly string[]> {
    const all = [...this.#entries.keys()];
    return prefix === undefined ? all : all.filter((key) => key.startsWith(prefix));
  }
}
