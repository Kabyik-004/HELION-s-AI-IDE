import type { FeatureDeps } from "../../../app/featureContext";
import { baseName } from "../../../shared/path/path";
import { isDirty } from "../editor.types";

/**
 * Close an editor tab, protecting unsaved work.
 *
 * Owns: the unsaved-changes decision and closing the tab.
 * Does not own: writing the file (delegated to `save-file`), or how the file was opened.
 *
 * The rule this module enforces: a dirty buffer is never discarded without an explicit answer.
 */
export interface CloseFileFeature {
  requestClose(path: string): Promise<void>;
  /** Closes every tab, prompting for each dirty file. Stops early if the developer cancels. */
  closeAll(): Promise<void>;
}

export interface CloseFileCollaborators {
  readonly saveFile: (path: string) => Promise<boolean>;
}

export function createCloseFileFeature(
  deps: FeatureDeps,
  collaborators: CloseFileCollaborators,
): CloseFileFeature {
  const requestClose = async (path: string): Promise<void> => {
    const buffer = deps.getState().editor.buffers[path];
    if (!isDirty(buffer)) {
      deps.dispatch({ type: "tabClosed", path });
      return;
    }

    const choice = await deps.dialogs.confirmUnsaved(baseName(path));
    if (choice === "cancel") return;
    if (choice === "save") {
      const saved = await collaborators.saveFile(path);
      // A failed save leaves the tab open rather than losing the edits.
      if (!saved) return;
    }
    deps.dispatch({ type: "tabClosed", path });
  };

  return {
    requestClose,

    async closeAll(): Promise<void> {
      for (const tab of [...deps.getState().editor.tabs]) {
        await requestClose(tab.path);
        // A cancel leaves the tab open, which stops the sequence.
        if (deps.getState().editor.tabs.some((candidate) => candidate.path === tab.path)) return;
      }
    },
  };
}
