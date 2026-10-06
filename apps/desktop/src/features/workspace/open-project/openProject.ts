import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import type { Workspace } from "../../../infrastructure/filesystem/workspaceService";

/**
 * Open a project folder.
 *
 * Owns: the native folder picker, opening a known path, and the sequence that turns a chosen
 * folder into the active workspace (publish it, remember it, read its root).
 * Does not own: closing, recent-project storage, or anything about file contents.
 */
export interface OpenProjectFeature {
  /** Shows the native folder picker. Does nothing when the user cancels. */
  openFromPicker(): Promise<void>;
  /** Opens a folder the developer chose previously (a recent entry). */
  openPath(path: string): Promise<void>;
}

export interface OpenProjectCollaborators {
  /** Reads a folder and publishes its listing. Injected by the composition root. */
  readonly loadDirectory: (path: string) => Promise<void>;
}

export function createOpenProjectFeature(
  deps: FeatureDeps,
  collaborators: OpenProjectCollaborators,
): OpenProjectFeature {
  const activate = async (workspace: Workspace): Promise<void> => {
    deps.dispatch({ type: "workspaceOpened", workspace });
    await deps.recentProjects.remember(workspace.path);
    // The path is passed explicitly rather than read back from state, which has not updated yet.
    await collaborators.loadDirectory(workspace.path);
  };

  return {
    async openFromPicker(): Promise<void> {
      try {
        const picked = await deps.workspace.pick();
        if (picked === null) return;
        await activate(picked);
      } catch (cause) {
        const described = describeFileSystemError(cause, "That folder could not be opened.");
        deps.logger.warn("open-project failed", { detail: described.detail });
        deps.notify("error", "Could not open that folder", described.message, described.detail);
      }
    },

    async openPath(path: string): Promise<void> {
      try {
        await activate(await deps.workspace.open(path));
      } catch (cause) {
        const described = describeFileSystemError(cause, "That folder could not be opened.");
        deps.logger.warn("open-project failed", { path, detail: described.detail });
        deps.notify("error", "Could not open that folder", described.message, described.detail);
      }
    },
  };
}
