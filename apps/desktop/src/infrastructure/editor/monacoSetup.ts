import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

/**
 * Monaco is bundled locally rather than loaded from a CDN.
 *
 * A desktop IDE must work offline, and it must not fetch executable JavaScript from a third
 * party at runtime. Importing the workers through Vite (`?worker`) bundles them into the app.
 *
 * This module is imported for its side effect (see `main.tsx`) and must run before any
 * `<Editor />` mounts.
 */

interface MonacoEnvironment {
  getWorker(workerId: string, label: string): Worker;
}

(self as unknown as { MonacoEnvironment: MonacoEnvironment }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Point @monaco-editor/react at the bundled instance instead of its default CDN loader.
loader.config({ monaco });

/**
 * A theme that matches the shell.
 *
 * Deriving from `vs-dark` keeps Monaco's contrast guarantees, while the editor background is set
 * to exactly the same hex as the surrounding panels so the editor reads as part of the window
 * rather than a lighter rectangle inside it.
 */
monaco.editor.defineTheme("forgeai-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "6d7480", fontStyle: "italic" },
    { token: "keyword", foreground: "f0a92a" },
    { token: "keyword.control", foreground: "f0a92a" },
    { token: "string", foreground: "93c98d" },
    { token: "number", foreground: "c4cad3" },
    { token: "type", foreground: "5aa9e6" },
    { token: "type.identifier", foreground: "5aa9e6" },
    { token: "identifier", foreground: "e7eaf0" },
    { token: "delimiter", foreground: "98a0ac" },
    { token: "tag", foreground: "e5534b" },
    { token: "attribute.name", foreground: "f0a92a" },
  ],
  colors: {
    "editor.background": "#0d0f12",
    "editor.foreground": "#e7eaf0",
    "editorGutter.background": "#0d0f12",
    "editorLineNumber.foreground": "#454c57",
    "editorLineNumber.activeForeground": "#98a0ac",
    "editor.selectionBackground": "#2b3038",
    "editor.inactiveSelectionBackground": "#23272e",
    "editor.lineHighlightBackground": "#121519",
    "editor.lineHighlightBorder": "#00000000",
    "editorCursor.foreground": "#f0a92a",
    "editorIndentGuide.background1": "#1c2026",
    "editorIndentGuide.activeBackground1": "#343a43",
    "editorWidget.background": "#121519",
    "editorWidget.border": "#2b3038",
    "editorSuggestWidget.background": "#121519",
    "editorSuggestWidget.border": "#2b3038",
    "editorSuggestWidget.selectedBackground": "#23272e",
    "editorHoverWidget.background": "#121519",
    "editorHoverWidget.border": "#2b3038",
    "editorOverviewRuler.border": "#00000000",
    "editorBracketMatch.background": "#23272e",
    "editorBracketMatch.border": "#dd9414",
    "scrollbarSlider.background": "#23272e80",
    "scrollbarSlider.hoverBackground": "#343a4390",
    "scrollbarSlider.activeBackground": "#454c57a0",
    "minimap.background": "#0d0f12",
  },
});
