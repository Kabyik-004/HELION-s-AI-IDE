import type { EditorProblem } from "../../shared/types/problem";

/** One open document. */
export interface EditorTab {
  readonly path: string;
  readonly name: string;
}

/**
 * How a file's contents are being presented.
 *
 * `binary` and `tooLarge` are first-class states rather than errors: loading a megabyte of
 * compiled output into a text editor is not useful, and saying so is more honest than showing
 * mojibake.
 */
export type BufferKind = "text" | "binary" | "tooLarge";

export interface EditorBuffer {
  readonly path: string;
  readonly kind: BufferKind;
  readonly language: string;
  content: string;
  savedContent: string;
  loading: boolean;
  error: string | undefined;
  size: number;
  /** File modification time at the last successful read or write. */
  modifiedAt: number;
  /** True when the file changed on disk while this buffer had unsaved edits. */
  externallyChanged: boolean;
}

/** True when the buffer has edits that have not been written to disk. */
export function isDirty(buffer: EditorBuffer | undefined): boolean {
  return buffer !== undefined && !buffer.loading && buffer.content !== buffer.savedContent;
}

export interface EditorSliceState {
  readonly tabs: readonly EditorTab[];
  readonly activeTabPath: string | null;
  readonly buffers: Readonly<Record<string, EditorBuffer>>;
  readonly cursor: { readonly line: number; readonly column: number };
  readonly problems: readonly EditorProblem[];
}

export function initialEditorSlice(): EditorSliceState {
  return { tabs: [], activeTabPath: null, buffers: {}, cursor: { line: 1, column: 1 }, problems: [] };
}
