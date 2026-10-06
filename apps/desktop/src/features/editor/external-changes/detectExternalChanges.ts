import { FileSystemError } from "@forgeai/shared";

import type { FeatureDeps } from "../../../app/featureContext";
import { baseName } from "../../../shared/path/path";
import { readFile } from "../../file-management/read-file/readFile";
import { isDirty } from "../editor.types";

/**
 * Detect files that changed on disk while they were open.
 *
 * Owns: comparing recorded modification times, reloading clean buffers, and warning about dirty
 * ones instead of overwriting the developer's edits.
 *
 * Scope: this is a **basic** detector, not a file watcher. It runs when the window regains focus,
 * which is the moment a developer returns from the editor that made the change. Continuous
 * watching is deliberately deferred — it is documented as a limitation rather than pretended.
 */
export interface ExternalChangesFeature {
  checkForExternalChanges(): Promise<void>;
}

export function createExternalChangesFeature(deps: FeatureDeps): ExternalChangesFeature {
  return {
    async checkForExternalChanges(): Promise<void> {
      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      for (const buffer of Object.values(deps.getState().editor.buffers)) {
        if (buffer.loading || buffer.error !== undefined || buffer.kind !== "text") continue;

        try {
          const info = await fileSystem.stat(buffer.path);
          if (info.modifiedAt === buffer.modifiedAt) continue;

          if (isDirty(buffer)) {
            // Never overwrite unsaved work; surface the conflict and let the developer decide.
            deps.dispatch({
              type: "bufferExternalConflict",
              path: buffer.path,
              modifiedAt: info.modifiedAt,
            });
          } else {
            const result = await readFile(fileSystem, buffer.path);
            if (result.kind === "text") {
              deps.dispatch({
                type: "bufferReloaded",
                path: buffer.path,
                content: result.text,
                size: result.size,
                modifiedAt: result.modifiedAt,
              });
            }
          }
        } catch (cause) {
          if (cause instanceof FileSystemError && cause.isNotFound) {
            deps.notify(
              "warning",
              `${baseName(buffer.path)} is no longer on disk`,
              "It was deleted or moved outside ForgeAI. The open copy is unchanged.",
            );
          }
        }
      }
    },
  };
}
