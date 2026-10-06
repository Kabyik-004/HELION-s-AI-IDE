/**
 * A diagnostic surfaced by the editor.
 *
 * Problems are produced by Monaco's own marker API (the TypeScript/JSON/CSS language services
 * running in a worker), so the Problems panel shows real diagnostics rather than a placeholder.
 */

export type ProblemSeverity = "error" | "warning" | "info";

export interface EditorProblem {
  /** Project-relative-ish path of the file the problem belongs to. */
  readonly path: string;
  readonly severity: ProblemSeverity;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}
