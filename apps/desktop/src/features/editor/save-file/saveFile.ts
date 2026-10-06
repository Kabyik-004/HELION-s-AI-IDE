import { FileSystemError } from "@forgeai/shared";

import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { baseName } from "../../../shared/path/path";
import { writeFile } from "../../file-management/write-file/writeFile";
import { isDirty } from "../editor.types";

/**
 * Save one file, or every file with unsaved changes.
 *
 * Owns: writing through the file system, clearing the dirty state, and save-specific error
 * reporting — including the "the file is gone" case, which is the one a developer is most likely
 * to hit and the least likely to guess.
 *
 * Depends on `write-file` (a leaf feature) rather than calling the port directly, so the write path
 * has one implementation.
 */
export interface SaveFileFeature {
  /** Writes the buffer to disk. Returns false when nothing was written. */
  saveFile(path: string): Promise<boolean>;
  /** Writes every buffer with unsaved changes. */
  saveAllFiles(): Promise<void>;
}

export function createSaveFileFeature(deps: FeatureDeps): SaveFileFeature {
  const saveFile = async (path: string): Promise<boolean> => {
    const buffer = deps.getState().editor.buffers[path];
    if (buffer === undefined || buffer.loading || buffer.kind !== "text") return false;

    const fileSystem = deps.fileSystem();
    if (fileSystem === null) {
      deps.notify("error", `Could not save ${baseName(path)}`, "No folder is open.");
      return false;
    }

    try {
      const { modifiedAt } = await writeFile(fileSystem, path, buffer.content);
      deps.dispatch({ type: "bufferSaved", path, modifiedAt });
      return true;
    } catch (cause) {
      const described = describeFileSystemError(cause, "The file could not be saved.");
      const vanished = cause instanceof FileSystemError && cause.isNotFound;
      deps.logger.warn("save-file failed", { path, detail: described.detail });
      deps.notify(
        "error",
        `Could not save ${baseName(path)}`,
        vanished ? "The file may have been deleted or moved outside ForgeAI." : described.message,
        described.detail,
      );
      return false;
    }
  };

  return {
    saveFile,

    async saveAllFiles(): Promise<void> {
      for (const buffer of Object.values(deps.getState().editor.buffers)) {
        if (isDirty(buffer)) await saveFile(buffer.path);
      }
    },
  };
}
