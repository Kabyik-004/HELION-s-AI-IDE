/**
 * File-system change events.
 *
 * Renaming or deleting a path is one operation, but it changes data owned by two features: the
 * explorer (cached listings, expansion, selection) and the editor (tabs, buffers). Rather than
 * letting either feature reach into the other, the operation emits one of these events and each
 * feature adjusts its own slice.
 *
 * This module owns the *shape* of those events and the path arithmetic they need. It is
 * genuinely shared between the two features and has no dependencies of its own.
 */

/** A file or folder was moved or renamed. */
export interface PathRenamedEvent {
  readonly type: "pathRenamed";
  readonly from: string;
  readonly to: string;
}

/** A file or folder was deleted. */
export interface PathRemovedEvent {
  readonly type: "pathRemoved";
  readonly path: string;
}

export type PathEvent = PathRenamedEvent | PathRemovedEvent;

/** True when `path` is `parent` itself or lives beneath it. */
export function isSameOrInside(path: string, parent: string): boolean {
  if (path === parent) return true;
  const lowerPath = path.toLowerCase();
  const lowerParent = parent.toLowerCase();
  return lowerPath.startsWith(`${lowerParent}\\`) || lowerPath.startsWith(`${lowerParent}/`);
}

/** Rewrites a path when its ancestor (or itself) has been renamed. */
export function remapPath(path: string, from: string, to: string): string {
  return path === from ? to : `${to}${path.slice(from.length)}`;
}
