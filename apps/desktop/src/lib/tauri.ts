import { invoke } from "@tauri-apps/api/core";

/**
 * The only place in the UI that knows ForgeAI runs inside Tauri.
 *
 * Keeping every `invoke` call here means the React components stay backend-agnostic: they call
 * this module, not `@tauri-apps/api`. When real capabilities arrive (file system, terminal,
 * keychain) their wrappers are added here and exposed as the matching ports from `@forgeai/shared`.
 */

/** Returned by the Rust `app_info` command. */
export interface AppInfo {
  readonly name: string;
  readonly version: string;
}

/**
 * Asks the Rust side for the product name and version.
 *
 * Returns `undefined` when running outside Tauri (for example `npm run dev:web` in a browser).
 * That is an expected condition, not an error, so it is reported honestly rather than faked.
 */
export async function fetchAppInfo(): Promise<AppInfo | undefined> {
  try {
    return await invoke<AppInfo>("app_info");
  } catch {
    return undefined;
  }
}
