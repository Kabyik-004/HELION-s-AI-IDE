export type EntryKind = "file" | "directory" | "symlink" | "other";

export interface DirEntry {
  readonly name: string;
  /** Absolute path of the entry. */
  readonly path: string;
  readonly kind: EntryKind;
}

export interface FileStat {
  readonly path: string;
  readonly kind: EntryKind;
  readonly size: number;
  /** Unix epoch milliseconds. */
  readonly modifiedAt: number;
}

/**
 * Read/write access to the user's project files.
 *
 * IMPORTANT: this port intentionally exposes no "escape the project root" capability.
 * Any implementation must confine every path to the opened project. Permission checks
 * happen one level up, in `@forgeai/tools`.
 */
export interface FileSystemPort {
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, contents: string): Promise<void>;
  delete(path: string, options?: { readonly recursive?: boolean }): Promise<void>;
  listDirectory(path: string): Promise<readonly DirEntry[]>;
  stat(path: string): Promise<FileStat>;
  exists(path: string): Promise<boolean>;
  /** Finds files matching a glob, relative to `root`. */
  search(root: string, pattern: string, options?: { readonly maxResults?: number }): Promise<readonly string[]>;
}
