import { FileSystemError } from "@forgeai/shared";
import type {
  DirectoryListing,
  FileContent,
  FileStat,
  FileSystemPort,
  ReadDirectoryOptions,
} from "@forgeai/shared";

import { backend } from "../ipc/backend";

/**
 * `FileSystemPort` backed by the Tauri backend, confined to one workspace root.
 *
 * ## Why the conversion happens here
 *
 * The interface (and therefore the UI) works in absolute paths, because that is what a developer
 * recognises and what the tab titles and status bar show. The backend, however, only ever accepts
 * workspace-relative paths, which is what makes path traversal impossible to express:
 *
 * ```text
 * UI (absolute) ──toRelative──▶ IPC (relative) ──▶ Rust resolve_relative ──▶ OS
 * UI (absolute) ◀──toAbsolute── IPC (relative) ◀── Rust
 * ```
 *
 * `toRelative` also refuses anything outside the root, so an invalid path is caught before it
 * costs an IPC round-trip. That check is a convenience, not the security boundary — the backend
 * performs its own authoritative validation.
 */
export class TauriFileSystem implements FileSystemPort {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root.replace(/[\\/]+$/, "");
  }

  get root(): string {
    return this.#root;
  }

  /* ------------------------------------------------------------------------- conversion -- */

  #toRelative(absolute: string): string {
    const normalised = absolute.replace(/[\\/]+$/, "");
    if (normalised === this.#root) return ".";

    const separator = this.#root.includes("\\") ? "\\" : "/";
    const prefix = `${this.#root}${separator}`;
    // Compare case-insensitively: Windows paths are case-insensitive.
    if (normalised.toLowerCase().startsWith(prefix.toLowerCase())) {
      return normalised.slice(prefix.length).replace(/\\/g, "/");
    }
    throw new FileSystemError("outsideWorkspace", "That path is outside the open folder.");
  }

  #toAbsolute(relative: string): string {
    if (relative === "" || relative === ".") return this.#root;
    const separator = this.#root.includes("\\") ? "\\" : "/";
    return `${this.#root}${separator}${relative.replace(/\//g, separator)}`;
  }

  /* --------------------------------------------------------------------------- operations */

  async readDirectory(path: string, options: ReadDirectoryOptions = {}): Promise<DirectoryListing> {
    const listing = await backend.readDirectory(this.#toRelative(path), options.showHidden ?? true);
    return {
      path: this.#toAbsolute(listing.path),
      truncated: listing.truncated,
      entries: listing.entries.map((entry) => ({
        name: entry.name,
        path: this.#toAbsolute(entry.path),
        kind: entry.kind,
      })),
    };
  }

  async readFile(path: string): Promise<FileContent> {
    const result = await backend.readFile(this.#toRelative(path));
    switch (result.kind) {
      case "text":
        return { kind: "text", text: result.text, size: result.size };
      case "binary":
        return { kind: "binary", size: result.size };
      case "tooLarge":
        return { kind: "tooLarge", size: result.size, limit: result.limit };
    }
  }

  async writeTextFile(path: string, contents: string): Promise<void> {
    await backend.writeFile(this.#toRelative(path), contents);
  }

  async createFile(path: string, contents?: string): Promise<void> {
    await backend.createFile(this.#toRelative(path), contents);
  }

  async createDirectory(path: string): Promise<void> {
    await backend.createDirectory(this.#toRelative(path));
  }

  async rename(from: string, to: string): Promise<void> {
    await backend.renamePath(this.#toRelative(from), this.#toRelative(to));
  }

  async delete(path: string, options: { readonly recursive?: boolean } = {}): Promise<void> {
    await backend.deletePath(this.#toRelative(path), options.recursive ?? false);
  }

  async stat(path: string): Promise<FileStat> {
    const result = await backend.statPath(this.#toRelative(path));
    return {
      path: this.#toAbsolute(result.path),
      kind: result.kind,
      size: result.size,
      modifiedAt: result.modifiedAt,
    };
  }

  async exists(path: string): Promise<boolean> {
    // An out-of-workspace path is a refusal, not a "no".
    return backend.pathExists(this.#toRelative(path));
  }

  async search(
    root: string,
    pattern: string,
    options: { readonly maxResults?: number } = {},
  ): Promise<readonly string[]> {
    if (this.#toRelative(root) !== ".") {
      throw new FileSystemError("invalidPath", "Search is only supported from the workspace root.");
    }
    const relative = await backend.searchPaths(pattern, options.maxResults);
    return relative.map((entry) => this.#toAbsolute(entry));
  }
}
