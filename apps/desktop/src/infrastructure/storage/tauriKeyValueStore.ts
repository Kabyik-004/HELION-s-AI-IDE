import type { KeyValueStore } from "@forgeai/storage";

import { backend } from "../ipc/backend";

/**
 * `KeyValueStore` backed by the application config file.
 *
 * The whole store is one JSON document, read once and written back whenever a key changes — the
 * right shape for the handful of preferences ForgeAI keeps (recent folders, selected provider,
 * layout). Writes are atomic on the Rust side, so an interrupted save cannot corrupt settings.
 *
 * Secrets never go here. API keys belong to the OS keychain, which is a separate capability
 * introduced in a later module.
 */
export class TauriKeyValueStore implements KeyValueStore {
  #cache: Record<string, unknown> | null = null;
  #loading: Promise<Record<string, unknown>> | null = null;

  async #state(): Promise<Record<string, unknown>> {
    if (this.#cache !== null) return this.#cache;
    this.#loading ??= backend.loadAppState().then((value) => {
      this.#cache = value ?? {};
      this.#loading = null;
      return this.#cache;
    });
    return this.#loading;
  }

  async #persist(state: Record<string, unknown>): Promise<void> {
    this.#cache = state;
    await backend.saveAppState(state);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const state = await this.#state();
    return state[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const state = await this.#state();
    await this.#persist({ ...state, [key]: value });
  }

  async delete(key: string): Promise<void> {
    const state = await this.#state();
    const next = { ...state };
    delete next[key];
    await this.#persist(next);
  }

  async keys(prefix?: string): Promise<readonly string[]> {
    const state = await this.#state();
    const all = Object.keys(state);
    return prefix === undefined ? all : all.filter((key) => key.startsWith(prefix));
  }
}
