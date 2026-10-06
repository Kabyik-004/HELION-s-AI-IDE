import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { baseName } from "../../../shared/path/path";
import { readFile } from "../../file-management/read-file/readFile";
import { isDirty } from "../editor.types";

/**
 * Re-read a file from disk, discarding in-memory edits.
 *
 * Owns: the "you will lose your edits" confirmation and replacing the buffer.
 * Does not own: saving, or noticing that a change happened (see `external-changes`).
 *
 * Exists because an unsaved buffer is never overwritten automatically: the developer is given an
 * explicit way out of a conflict instead of being trapped by it.
 */
export interface ReloadFileFeature {
  reloadFile(path: string): Promise<void>;
}

export function createReloadFileFeature(deps: FeatureDeps): ReloadFileFeature {
  return {
    async reloadFile(path: string): Promise<void> {
      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      if (isDirty(deps.getState().editor.buffers[path])) {
        const confirmed = await deps.dialogs.confirm({
          title: `Reload ${baseName(path)} from disk?`,
          message: "The version on disk will replace your unsaved edits.",
          confirmLabel: "Discard and reload",
          destructive: true,
        });
        if (!confirmed) return;
      }

      try {
        const result = await readFile(fileSystem, path);
        if (result.kind !== "text") {
          deps.dispatch({ type: "bufferUnavailable", path, kind: result.kind, size: result.size });
          return;
        }
        deps.dispatch({
          type: "bufferReloaded",
          path,
          content: result.text,
          size: result.size,
          modifiedAt: result.modifiedAt,
        });
      } catch (cause) {
        const described = describeFileSystemError(cause, "The file could not be reloaded.");
        deps.notify("error", `Could not reload ${baseName(path)}`, described.message, described.detail);
      }
    },
  };
}
