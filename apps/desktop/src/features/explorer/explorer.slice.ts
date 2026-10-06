import type { DirectoryListing } from "@forgeai/shared";

import { isSameOrInside, remapPath } from "../path-events/pathEvents";
import type { IdeAction } from "../../app/ideActions";

/**
 * The explorer's state: the directory listing cache, which folders are expanded, what is selected,
 * and whether dot-files are shown.
 *
 * `pathRenamed` / `pathRemoved` are handled here because cached listings and expansion state are
 * the explorer's data to keep correct — the operation that produced the event does not reach in.
 */
export interface ExplorerSliceState {
  readonly directories: Readonly<Record<string, DirectoryListing>>;
  readonly expanded: readonly string[];
  readonly selectedPath: string | null;
  readonly showHiddenFiles: boolean;
}

export function initialExplorerSlice(): ExplorerSliceState {
  return { directories: {}, expanded: [], selectedPath: null, showHiddenFiles: true };
}

export type ExplorerAction =
  | { readonly type: "listingLoaded"; readonly path: string; readonly listing: DirectoryListing }
  | { readonly type: "directoryExpanded"; readonly path: string }
  | { readonly type: "directoryCollapsed"; readonly path: string }
  | { readonly type: "allDirectoriesCollapsed" }
  | { readonly type: "pathSelected"; readonly path: string | null }
  | { readonly type: "showHiddenChanged"; readonly value: boolean }
  | { readonly type: "workspaceOpened"; readonly workspace: { readonly path: string } }
  | { readonly type: "workspaceClosed" }
  | { readonly type: "pathRenamed"; readonly from: string; readonly to: string }
  | { readonly type: "pathRemoved"; readonly path: string };

function withoutDescendants<T>(entries: Readonly<Record<string, T>>, path: string): Record<string, T> {
  const next: Record<string, T> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!isSameOrInside(key, path)) next[key] = value;
  }
  return next;
}

export function reduceExplorer(state: ExplorerSliceState, action: IdeAction): ExplorerSliceState {
  switch (action.type) {
    case "listingLoaded":
      return { ...state, directories: { ...state.directories, [action.path]: action.listing } };

    case "directoryExpanded":
      if (state.expanded.includes(action.path)) return state;
      return { ...state, expanded: [...state.expanded, action.path] };

    case "directoryCollapsed":
      return { ...state, expanded: state.expanded.filter((path) => path !== action.path) };

    case "allDirectoriesCollapsed":
      return { ...state, expanded: [] };

    case "pathSelected":
      return { ...state, selectedPath: action.path };

    case "showHiddenChanged":
      // The cache was built with the previous filter, so it is discarded wholesale.
      return { ...state, showHiddenFiles: action.value, directories: {} };

    case "workspaceOpened":
    case "workspaceClosed":
      return { ...state, directories: {}, expanded: [], selectedPath: null };

    case "pathRenamed":
      return {
        ...state,
        expanded: state.expanded.map((path) =>
          isSameOrInside(path, action.from) ? remapPath(path, action.from, action.to) : path,
        ),
        selectedPath:
          state.selectedPath !== null && isSameOrInside(state.selectedPath, action.from)
            ? remapPath(state.selectedPath, action.from, action.to)
            : state.selectedPath,
        directories: withoutDescendants(state.directories, action.from),
      };

    case "pathRemoved":
      return {
        ...state,
        expanded: state.expanded.filter((path) => !isSameOrInside(path, action.path)),
        selectedPath:
          state.selectedPath !== null && isSameOrInside(state.selectedPath, action.path)
            ? null
            : state.selectedPath,
        directories: withoutDescendants(state.directories, action.path),
      };

    default:
      return state;
  }
}
