import type { FeatureDeps } from "../../app/featureContext";

/**
 * The explorer's trivial commands.
 *
 * Expanding needs one decision the explorer owns: a folder that has never been read is read on
 * first expand, and never read again from here (refreshes go through the refresh feature). That is
 * why the load collaborator is injected rather than imported.
 */
export interface ExplorerActions {
  expandDirectory(path: string): void;
  collapseDirectory(path: string): void;
  collapseAllDirectories(): void;
  selectPath(path: string | null): void;
  /** Flips the dot-file setting and re-reads what is visible. */
  toggleShowHiddenFiles(): Promise<void>;
}

export interface ExplorerActionCollaborators {
  readonly loadDirectory: (path: string) => Promise<void>;
}

export function createExplorerActions(
  deps: FeatureDeps,
  collaborators: ExplorerActionCollaborators,
): ExplorerActions {
  return {
    expandDirectory(path: string): void {
      deps.dispatch({ type: "directoryExpanded", path });
      // Lazy by design: a large tree must not be read eagerly.
      if (deps.getState().explorer.directories[path] === undefined) {
        void collaborators.loadDirectory(path);
      }
    },

    collapseDirectory(path: string): void {
      deps.dispatch({ type: "directoryCollapsed", path });
    },

    collapseAllDirectories(): void {
      deps.dispatch({ type: "allDirectoriesCollapsed" });
    },

    selectPath(path: string | null): void {
      deps.dispatch({ type: "pathSelected", path });
    },

    async toggleShowHiddenFiles(): Promise<void> {
      deps.dispatch({ type: "showHiddenChanged", value: !deps.getState().explorer.showHiddenFiles });
      // The cache was built with the previous filter, so everything visible is read again.
      const root = deps.getState().workspace.workspace?.path;
      if (root === undefined) return;
      for (const path of [root, ...deps.getState().explorer.expanded]) {
        await collaborators.loadDirectory(path);
      }
    },
  };
}
