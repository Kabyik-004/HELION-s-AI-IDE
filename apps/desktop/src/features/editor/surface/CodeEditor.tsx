import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback } from "react";

import { useIde } from "../../../app/IdeProvider";
import type { EditorBuffer } from "../editor.types";

export interface CodeEditorProps {
  readonly buffer: EditorBuffer;
}

/**
 * The Monaco surface.
 *
 * Monaco is bundled locally (see `infrastructure/editor/monacoSetup.ts`) so the IDE works offline.
 * Two details matter here:
 *
 *  - `path` gives every file its own Monaco model, which preserves undo history and folding when
 *    switching tabs.
 *  - `value` is driven from the editor slice, so a buffer has a single source of truth. Monaco only
 *    receives a new value when it actually differs, because the library guards its own update.
 */
export function CodeEditor({ buffer }: CodeEditorProps) {
  const { api } = useIde();

  const handleMount = useCallback<OnMount>(
    (editor) => {
      editor.onDidChangeCursorPosition((event) => {
        // Monaco columns are already 1-based, matching what developers expect to see.
        api.editor.setCursor(event.position.lineNumber, event.position.column);
      });
      editor.focus();
    },
    [api.editor],
  );

  if (buffer.loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-ink-500">
        Reading {buffer.path.split(/[\\/]/).pop()}…
      </div>
    );
  }

  if (buffer.error !== undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-xs font-medium text-danger-500">Could not open this file</p>
        <p className="text-[11px] text-ink-400">{buffer.error}</p>
      </div>
    );
  }

  return (
    <Editor
      // No `key`: the same Monaco instance switches models when `path` changes, which is what
      // preserves per-file undo history and scroll position.
      // Monaco treats the path as a URI, so Windows separators are normalised.
      path={buffer.path.replace(/\\/g, "/")}
      language={buffer.language}
      value={buffer.content}
      theme="forgeai-dark"
      onChange={(next) => api.editor.updateBuffer(buffer.path, next ?? "")}
      onMount={handleMount}
      options={{
        automaticLayout: true,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
        fontSize: 13,
        lineHeight: 20,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        renderLineHighlight: "line",
        cursorBlinking: "smooth",
        smoothScrolling: true,
        tabSize: 2,
        insertSpaces: true,
        padding: { top: 10, bottom: 10 },
        bracketPairColorization: { enabled: true },
        guides: { indentation: true, bracketPairs: false },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
        wordWrap: "off",
        contextmenu: false,
        fixedOverflowWidgets: true,
      }}
    />
  );
}
