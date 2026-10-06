import { isSameOrInside, remapPath } from "../path-events/pathEvents";
import type { EditorProblem } from "../../shared/types/problem";
import type { IdeAction } from "../../app/ideActions";
import {
  initialEditorSlice,
  isDirty,
  type BufferKind,
  type EditorBuffer,
  type EditorSliceState,
  type EditorTab,
} from "./editor.types";

/**
 * The editor's state: open tabs, per-file buffers, the cursor, and diagnostics.
 *
 * `pathRenamed` / `pathRemoved` are handled here so a rename or delete in the explorer keeps
 * open documents consistent without the file operations knowing anything about tabs.
 */
export type EditorAction =
  | { readonly type: "tabOpened"; readonly path: string }
  | { readonly type: "tabClosed"; readonly path: string }
  | { readonly type: "allTabsClosed" }
  | { readonly type: "tabActivated"; readonly path: string }
  | { readonly type: "bufferLoading"; readonly path: string; readonly language: string }
  | {
      readonly type: "bufferLoaded";
      readonly path: string;
      readonly content: string;
      readonly size: number;
      readonly modifiedAt: number;
    }
  | { readonly type: "bufferUnavailable"; readonly path: string; readonly kind: BufferKind; readonly size: number }
  | { readonly type: "bufferChanged"; readonly path: string; readonly content: string }
  | { readonly type: "bufferSaved"; readonly path: string; readonly modifiedAt: number }
  | { readonly type: "bufferFailed"; readonly path: string; readonly message: string }
  | {
      readonly type: "bufferReloaded";
      readonly path: string;
      readonly content: string;
      readonly size: number;
      readonly modifiedAt: number;
    }
  | { readonly type: "bufferExternalConflict"; readonly path: string; readonly modifiedAt: number }
  | { readonly type: "cursorMoved"; readonly line: number; readonly column: number }
  | { readonly type: "problemsReplaced"; readonly problems: readonly EditorProblem[] }
  | { readonly type: "workspaceOpened"; readonly workspace: { readonly path: string } }
  | { readonly type: "workspaceClosed" }
  | { readonly type: "pathRenamed"; readonly from: string; readonly to: string }
  | { readonly type: "pathRemoved"; readonly path: string };

function baseNameOf(path: string): string {
  const cut = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"));
  return cut < 0 ? path : path.slice(cut + 1);
}

export function reduceEditor(state: EditorSliceState, action: IdeAction): EditorSliceState {
  switch (action.type) {
    case "tabOpened": {
      const exists = state.tabs.some((tab) => tab.path === action.path);
      return {
        ...state,
        activeTabPath: action.path,
        tabs: exists ? state.tabs : [...state.tabs, { path: action.path, name: baseNameOf(action.path) }],
      };
    }

    case "tabClosed": {
      const index = state.tabs.findIndex((tab) => tab.path === action.path);
      if (index === -1) return state;
      const tabs = state.tabs.filter((tab) => tab.path !== action.path);
      if (state.activeTabPath !== action.path) return { ...state, tabs };
      const next = tabs[index] ?? tabs[index - 1] ?? null;
      // The buffer is intentionally kept: reopening a closed file restores unsaved edits rather
      // than silently discarding the developer's work.
      return { ...state, tabs, activeTabPath: next?.path ?? null };
    }

    case "allTabsClosed":
      return { ...state, tabs: [], activeTabPath: null };

    case "tabActivated":
      return { ...state, activeTabPath: action.path };

    case "bufferLoading": {
      const existing = state.buffers[action.path];
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: {
            path: action.path,
            kind: existing?.kind ?? "text",
            language: action.language,
            content: existing?.content ?? "",
            savedContent: existing?.savedContent ?? "",
            loading: true,
            error: undefined,
            size: existing?.size ?? 0,
            modifiedAt: existing?.modifiedAt ?? 0,
            externallyChanged: false,
          },
        },
      };
    }

    case "bufferLoaded":
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: {
            path: action.path,
            kind: "text",
            language: state.buffers[action.path]?.language ?? "plaintext",
            content: action.content,
            savedContent: action.content,
            loading: false,
            error: undefined,
            size: action.size,
            modifiedAt: action.modifiedAt,
            externallyChanged: false,
          },
        },
      };

    case "bufferUnavailable":
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: {
            path: action.path,
            kind: action.kind,
            language: state.buffers[action.path]?.language ?? "plaintext",
            content: "",
            savedContent: "",
            loading: false,
            error: undefined,
            size: action.size,
            modifiedAt: state.buffers[action.path]?.modifiedAt ?? 0,
            externallyChanged: false,
          },
        },
      };

    case "bufferChanged": {
      const buffer = state.buffers[action.path];
      if (buffer === undefined) return state;
      return { ...state, buffers: { ...state.buffers, [action.path]: { ...buffer, content: action.content } } };
    }

    case "bufferSaved": {
      const buffer = state.buffers[action.path];
      if (buffer === undefined) return state;
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: {
            ...buffer,
            savedContent: buffer.content,
            size: buffer.content.length,
            modifiedAt: action.modifiedAt,
            externallyChanged: false,
          },
        },
      };
    }

    case "bufferFailed": {
      const buffer = state.buffers[action.path];
      if (buffer === undefined) return state;
      return {
        ...state,
        buffers: { ...state.buffers, [action.path]: { ...buffer, loading: false, error: action.message } },
      };
    }

    case "bufferReloaded": {
      const buffer = state.buffers[action.path];
      if (buffer === undefined) return state;
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: {
            ...buffer,
            kind: "text",
            content: action.content,
            savedContent: action.content,
            loading: false,
            error: undefined,
            size: action.size,
            modifiedAt: action.modifiedAt,
            externallyChanged: false,
          },
        },
      };
    }

    case "bufferExternalConflict": {
      const buffer = state.buffers[action.path];
      if (buffer === undefined) return state;
      return {
        ...state,
        buffers: {
          ...state.buffers,
          [action.path]: { ...buffer, externallyChanged: true, modifiedAt: action.modifiedAt },
        },
      };
    }

    case "cursorMoved":
      return { ...state, cursor: { line: action.line, column: action.column } };

    case "problemsReplaced":
      return { ...state, problems: action.problems };

    case "workspaceOpened":
    case "workspaceClosed":
      return initialEditorSlice();

    case "pathRenamed": {
      const buffers: Record<string, EditorBuffer> = {};
      for (const [key, buffer] of Object.entries(state.buffers)) {
        if (isSameOrInside(key, action.from)) {
          const path = remapPath(key, action.from, action.to);
          buffers[path] = { ...buffer, path };
        } else {
          buffers[key] = buffer;
        }
      }
      const tabs: EditorTab[] = state.tabs.map((tab) => {
        if (!isSameOrInside(tab.path, action.from)) return tab;
        const path = remapPath(tab.path, action.from, action.to);
        return { path, name: baseNameOf(path) };
      });
      return {
        ...state,
        buffers,
        tabs,
        activeTabPath:
          state.activeTabPath !== null && isSameOrInside(state.activeTabPath, action.from)
            ? remapPath(state.activeTabPath, action.from, action.to)
            : state.activeTabPath,
      };
    }

    case "pathRemoved": {
      const tabs = state.tabs.filter((tab) => !isSameOrInside(tab.path, action.path));
      let activeTabPath = state.activeTabPath;
      if (activeTabPath !== null && isSameOrInside(activeTabPath, action.path)) {
        const index = state.tabs.findIndex((tab) => tab.path === activeTabPath);
        const remaining = tabs[index] ?? tabs[index - 1] ?? null;
        activeTabPath = remaining?.path ?? null;
      }
      const buffers: Record<string, EditorBuffer> = {};
      for (const [key, buffer] of Object.entries(state.buffers)) {
        if (!isSameOrInside(key, action.path)) buffers[key] = buffer;
      }
      return { ...state, tabs, activeTabPath, buffers };
    }

    default:
      return state;
  }
}

export { isDirty, initialEditorSlice };
export type { EditorBuffer, EditorTab, BufferKind, EditorSliceState };
