import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { baseName, dirName, joinPath } from "../../../shared/path/path";
import { validateEntryName } from "../shared/nameValidation";

/**
 * Rename a file or a folder.
 *
 * Owns: the rename prompt, validation, the move call, rename-specific error reporting, and
 * publishing the change so the explorer and editor can update what they own.
 * Does not own: creating, deleting, or the contents of open documents.
 *
 * One operation for both files and folders because renaming is the same act for either; the
 * distinction lives in the file system, not here.
 */
export interface RenamePathFeature {
  renamePath(path: string): Promise<void>;
}

export interface RenamePathCollaborators {
  readonly reloadDirectory: (path: string) => Promise<void>;
}

export function createRenamePathFeature(
  deps: FeatureDeps,
  collaborators: RenamePathCollaborators,
): RenamePathFeature {
  return {
    async renamePath(path: string): Promise<void> {
      const currentName = baseName(path);
      const parent = dirName(path);
      const taken = deps.getState().explorer.directories[parent]?.entries.map((entry) => entry.name) ?? [];

      const name = await deps.dialogs.prompt({
        title: "Rename",
        label: "New name",
        initialValue: currentName,
        confirmLabel: "Rename",
        validate: validateEntryName,
        taken,
      });
      if (name === null || name === currentName) return;

      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      const destination = joinPath(parent, name);
      try {
        await fileSystem.rename(path, destination);
      } catch (cause) {
        const described = describeFileSystemError(cause, "It could not be renamed.");
        deps.logger.warn("rename-path failed", { from: path, to: destination, detail: described.detail });
        deps.notify("error", `Could not rename ${currentName}`, described.message, described.detail);
        return;
      }

      // One event; the explorer and editor each fix up the data they own.
      deps.dispatch({ type: "pathRenamed", from: path, to: destination });
      await collaborators.reloadDirectory(parent);
    },
  };
}
