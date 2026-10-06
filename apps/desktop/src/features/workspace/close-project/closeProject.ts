import type { FeatureDeps } from "../../../app/featureContext";
import { isDirty } from "../../editor/editor.types";

/**
 * Close the open project folder.
 *
 * Owns: the decision to close, including the "you have unsaved files" guard.
 * Does not own: choosing a folder, or reading directories.
 *
 * The guard exists because closing a folder with dirty buffers would otherwise discard edits
 * silently. Edits themselves are not thrown away by *closing* — the buffers live in the editor
 * slice until the workspace changes — but the developer deserves to know before it happens.
 */
export interface CloseProjectFeature {
  closeProject(): Promise<void>;
}

export function createCloseProjectFeature(deps: FeatureDeps): CloseProjectFeature {
  return {
    async closeProject(): Promise<void> {
      const state = deps.getState();
      if (state.workspace.workspace === null) return;

      const dirtyCount = Object.values(state.editor.buffers).filter((buffer) => isDirty(buffer)).length;
      if (dirtyCount > 0) {
        const confirmed = await deps.dialogs.confirm({
          title: "Close this folder?",
          message: `${dirtyCount} file${dirtyCount === 1 ? " has" : "s have"} unsaved changes.`,
          detail: "Closing the folder discards them.",
          confirmLabel: "Close anyway",
          destructive: true,
        });
        if (!confirmed) return;
      }

      try {
        await deps.workspace.close();
      } catch (cause) {
        deps.logger.warn("closing the workspace failed", { detail: String(cause) });
      }
      deps.dispatch({ type: "workspaceClosed" });
    },
  };
}
