/**
 * Git domain types.
 *
 * These mirror what a developer sees in a Git client, not the raw porcelain output, so the UI
 * never has to parse `git status --short`.
 */

export type GitFileStatus =
  | "unmodified"
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "ignored"
  | "conflicted";

export interface GitStatusEntry {
  /** Project-relative path. */
  readonly path: string;
  /** Status in the index (staged). */
  readonly index: GitFileStatus;
  /** Status in the working tree (unstaged). */
  readonly workTree: GitFileStatus;
  /** Original path for renames/copies. */
  readonly previousPath?: string;
}

export interface GitStatus {
  readonly branch: string | undefined;
  /** Commits ahead of the upstream branch. */
  readonly ahead: number;
  /** Commits behind the upstream branch. */
  readonly behind: number;
  readonly entries: readonly GitStatusEntry[];
  /** True when the working tree has no changes. */
  readonly clean: boolean;
}

export interface GitDiffOptions {
  /** Project-relative path to limit the diff to. */
  readonly path?: string;
  /** When true, diff what is staged instead of the working tree. */
  readonly staged?: boolean;
}

export interface GitDiff {
  /** Unified diff text, or empty when there are no changes. */
  readonly text: string;
  readonly path?: string;
  readonly staged: boolean;
  readonly additions: number;
  readonly deletions: number;
}

export interface GitCommitInfo {
  readonly hash: string;
  readonly shortHash: string;
  readonly subject: string;
  readonly authorName: string;
  readonly authorEmail: string;
  /** ISO-8601 timestamp. */
  readonly date: string;
  readonly parents: readonly string[];
}

export interface GitCommitRequest {
  readonly message: string;
  /** When true, stage all tracked modifications before committing. */
  readonly stageAll?: boolean;
  /** Project-relative paths to stage and commit. */
  readonly paths?: readonly string[];
}
