import type { FeatureDeps } from "../../../app/featureContext";

/**
 * Refresh what the explorer is showing.
 *
 * Owns only the decision of *what* to re-read (the root, plus every expanded folder); reading is
 * delegated to the load-directory feature so there is one implementation of that.
 */
export interface RefreshDirectoryFeature {
  /** Re-reads one folder. */
  refreshDirectory(path: string): Promise<void>;
  /** Re-reads the workspace root and every expanded folder. */
  refreshTree(): Promise<void>;
}

export interface RefreshDirectoryCollaborators {
  readonly loadDirectory: (path: string) => Promise<void>;
}

export function createRefreshDirectoryFeature(
  deps: FeatureDeps,
  collaborators: RefreshDirectoryCollaborators,
): RefreshDirectoryFeature {
  return {
    refreshDirectory: collaborators.loadDirectory,

    async refreshTree(): Promise<void> {
      const state = deps.getState();
      const root = state.workspace.workspace?.path;
      if (root === undefined) return;
      // Every folder that is currently open is read again; collapsed folders are left alone.
      for (const path of [root, ...state.explorer.expanded]) {
        await collaborators.loadDirectory(path);
      }
    },
  };
}
