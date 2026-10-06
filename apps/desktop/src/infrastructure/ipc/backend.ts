import { invoke } from "@tauri-apps/api/core";

import { FileSystemError } from "@forgeai/shared";
import type { EntryKind } from "@forgeai/shared";

/**
 * The one place in ForgeAI that speaks Tauri IPC.
 *
 * Every `invoke` call lives here so nothing else imports `@tauri-apps/api`. The wrappers are
 * typed, and every rejection is normalised into a `FileSystemError` — the backend already sends
 * friendly messages, and a raw Rust error must never reach the interface.
 *
 * Paths crossing this boundary are **workspace-relative** and `/`-separated. The backend rejects
 * absolute paths and any `..` component, so a compromised renderer cannot reach outside the
 * folder the user opened.
 */

/* -------------------------------------------------------------------------- wire shapes -- */

export interface WorkspaceInfoDto {
  /** Display path of the workspace root (no Windows verbatim prefix). */
  readonly path: string;
  readonly name: string;
}

export interface DirEntryDto {
  readonly name: string;
  /** Workspace-relative. */
  readonly path: string;
  readonly kind: EntryKind;
}

export interface DirectoryListingDto {
  readonly path: string;
  readonly entries: readonly DirEntryDto[];
  readonly truncated: boolean;
}

export interface FileStatDto {
  readonly path: string;
  readonly kind: EntryKind;
  readonly size: number;
  readonly modifiedAt: number;
}

export type FileContentDto =
  | { readonly kind: "text"; readonly text: string; readonly size: number }
  | { readonly kind: "binary"; readonly size: number }
  | { readonly kind: "tooLarge"; readonly size: number; readonly limit: number };

/* ------------------------------------------------------------------------------ helpers -- */

export interface AppInfoDto {
  readonly name: string;
  readonly version: string;
}

async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (cause) {
    throw FileSystemError.from(cause);
  }
}

/* ------------------------------------------------------------------------------ backend -- */

export const backend = {
  appInfo: () => call<AppInfoDto>("app_info"),

  /* Workspace lifecycle */
  openWorkspace: (path: string) => call<WorkspaceInfoDto>("open_workspace", { path }),
  currentWorkspace: () => call<WorkspaceInfoDto | null>("current_workspace"),
  closeWorkspace: () => call<void>("close_workspace"),

  /* Files and directories, all workspace-relative */
  readDirectory: (path: string, showHidden: boolean) =>
    call<DirectoryListingDto>("read_directory", { path, showHidden }),
  readFile: (path: string) => call<FileContentDto>("read_file", { path }),
  writeFile: (path: string, contents: string) => call<void>("write_file", { path, contents }),
  createFile: (path: string, contents?: string) =>
    call<void>("create_file", { path, contents: contents ?? null }),
  createDirectory: (path: string) => call<void>("create_directory", { path }),
  renamePath: (from: string, to: string) => call<void>("rename_path", { from, to }),
  deletePath: (path: string, recursive: boolean) => call<void>("delete_path", { path, recursive }),
  statPath: (path: string) => call<FileStatDto>("stat_path", { path }),
  pathExists: (path: string) => call<boolean>("path_exists", { path }),
  searchPaths: (pattern: string, maxResults?: number) =>
    call<string[]>("search_paths", { pattern, maxResults: maxResults ?? null }),

  /* Preference storage: a single JSON file in the app config directory */
  loadAppState: () => call<Record<string, unknown> | null>("load_app_state"),
  saveAppState: (value: Record<string, unknown>) => call<void>("save_app_state", { value }),
} as const;
