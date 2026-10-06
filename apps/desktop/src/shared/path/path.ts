/**
 * Path string helpers.
 *
 * Deliberately platform-agnostic: paths arriving from the backend use the platform separator,
 * paths crossing IPC use `/`. These helpers accept either and never touch the file system — the
 * real confinement rules live in the Rust workspace module.
 */

/** File name (with extension) from an absolute or relative path. */
export function baseName(path: string): string {
  const normalised = path.replace(/[\\/]+$/, "");
  const cut = Math.max(normalised.lastIndexOf("\\"), normalised.lastIndexOf("/"));
  return cut < 0 ? normalised : normalised.slice(cut + 1);
}

/** Parent directory of a path, or the path itself when it has no separator. */
export function dirName(path: string): string {
  const normalised = path.replace(/[\\/]+$/, "");
  const cut = Math.max(normalised.lastIndexOf("\\"), normalised.lastIndexOf("/"));
  return cut <= 0 ? normalised : normalised.slice(0, cut);
}

/** Lower-cased extension without the dot, or an empty string. */
export function extensionOf(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  // `dot <= 0` keeps dotfiles such as `.env` from being read as an extension.
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Joins a directory and a child name using the directory's own separator style. */
export function joinPath(directory: string, name: string): string {
  const separator = directory.includes("\\") ? "\\" : "/";
  return `${directory.replace(/[\\/]+$/, "")}${separator}${name}`;
}
