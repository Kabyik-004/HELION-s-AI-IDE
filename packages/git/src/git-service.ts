import type { CommandRunnerPort } from "@forgeai/shared";

import type { GitCommitInfo, GitCommitRequest, GitDiff, GitDiffOptions, GitStatus } from "./git-types";

/**
 * Read and write access to the project's Git repository.
 *
 * Module 0 ships **no implementation**. A real implementation is built on `CommandRunnerPort`
 * (from `@forgeai/shared`) so that it inherits the terminal's permission gating and path
 * confinement, rather than shelling out on its own.
 *
 * Risk classification for when these become tools:
 *   - `status`, `diff`, `log`, `branches`  → SAFE     (read-only)
 *   - `commit`                             → MODERATE (changes repository history)
 *   - (future) `push`, `reset --hard`      → DANGEROUS
 *
 * TODO(module-4): implement `GitService` over `CommandRunnerPort`.
 */
export interface GitService {
  status(projectRoot: string): Promise<GitStatus>;
  diff(projectRoot: string, options?: GitDiffOptions): Promise<GitDiff>;
  log(projectRoot: string, options?: { readonly limit?: number }): Promise<readonly GitCommitInfo[]>;
  branches(projectRoot: string): Promise<readonly string[]>;
  commit(projectRoot: string, request: GitCommitRequest): Promise<GitCommitInfo>;
}

/** Factory signature for later modules; keeps construction injectable. */
export interface GitServiceFactory {
  create(options: { readonly commands: CommandRunnerPort }): GitService;
}
