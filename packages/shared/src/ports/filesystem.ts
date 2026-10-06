export type EntryKind = "file" | "directory" | "symlink" | "other";

export interface DirEntry {
  readonly name: string;
  /** Absolute path of the entry. */
  readonly path: string;
  readonly kind: EntryKind;
}

export interface DirectoryListing {
  readonly path: string;
  readonly entries: readonly DirEntry[];
  /**
   * True when the directory holds more entries than the implementation returns.
   *
   * A source directory with tens of thousands of children must not stall the UI, so
   * implementations cap what they return and report it here rather than pretending the
   * listing is complete.
   */
  readonly truncated: boolean;
}

export interface FileStat {
  readonly path: string;
  readonly kind: EntryKind;
  readonly size: number;
  /** Unix epoch milliseconds. */
  readonly modifiedAt: number;
}

/**
 * The result of reading a file.
 *
 * A discriminated union rather than a bare string, because "this is not text" and "this is too
 * large to load" are normal outcomes that the UI must show honestly instead of loading a
 * megabyte of binary into a text editor.
 */
export type FileContent =
  | { readonly kind: "text"; readonly text: string; readonly size: number }
  | { readonly kind: "binary"; readonly size: number }
  | { readonly kind: "tooLarge"; readonly size: number; readonly limit: number };

export interface ReadDirectoryOptions {
  /** When false, names beginning with `.` are omitted. Defaults to true. */
  readonly showHidden?: boolean;
}

/**
 * Read/write access to the user's project files.
 *
 * SECURITY: this port intentionally exposes no "escape the project root" capability, and no
 * implementation may add one. Every path must be confined to the opened workspace; traversal
 * attempts are rejected by the implementation, never by the caller.
 *
 * Paths are absolute and use the platform separator, because the UI displays them. The Tauri
 * implementation converts them to workspace-relative paths before crossing the IPC boundary,
 * so the backend never has to trust an absolute path from the renderer.
 */
export interface FileSystemPort {
  readDirectory(path: string, options?: ReadDirectoryOptions): Promise<DirectoryListing>;
  /** Reads a file, reporting binary and oversized files instead of returning garbage. */
  readFile(path: string): Promise<FileContent>;
  writeTextFile(path: string, contents: string): Promise<void>;
  /** Creates a new empty (or pre-filled) file. Fails if the path already exists. */
  createFile(path: string, contents?: string): Promise<void>;
  /** Creates a directory. Fails if the path already exists. */
  createDirectory(path: string): Promise<void>;
  /** Moves or renames a file or directory. Fails if the destination exists. */
  rename(from: string, to: string): Promise<void>;
  /** Deletes a file, or a directory when `recursive` is true. */
  delete(path: string, options?: { readonly recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<FileStat>;
  exists(path: string): Promise<boolean>;
  /** Finds files whose name contains `pattern`, relative to `root`. */
  search(root: string, pattern: string, options?: { readonly maxResults?: number }): Promise<readonly string[]>;
}
