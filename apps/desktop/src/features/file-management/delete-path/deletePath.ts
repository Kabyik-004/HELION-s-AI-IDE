import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { baseName, dirName } from "../../../shared/path/path";

/**
 * Delete a file or a folder.
 *
 * Owns: the confirmation dialog, the delete call, delete-specific error reporting, and publishing
 * the removal so the explorer and editor can drop what they hold.
 *
 * Safety: deletion is *always* confirmed, and recursive deletion only happens after the developer
 * approves a prompt that says the folder's contents go with it. There is no silent recursive
 * delete path in this module.
 */
export interface DeletePathFeature {
  deletePath(path: string): Promise<void>;
}

export interface DeletePathCollaborators {
  readonly reloadDirectory: (path: string) => Promise<void>;
}

export function createDeletePathFeature(
  deps: FeatureDeps,
  collaborators: DeletePathCollaborators,
): DeletePathFeature {
  return {
    async deletePath(path: string): Promise<void> {
      const name = baseName(path);
      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      // The kind decides the wording and whether recursion is needed, so it is read before asking.
      let isDirectory: boolean;
      try {
        isDirectory = (await fileSystem.stat(path)).kind === "directory";
      } catch (cause) {
        const described = describeFileSystemError(cause, "It could not be found.");
        deps.notify("error", `Could not remove ${name}`, described.message, described.detail);
        return;
      }

      const confirmed = await deps.dialogs.confirm({
        title: isDirectory ? `Delete the folder "${name}"?` : `Delete "${name}"?`,
        message: isDirectory
          ? "This will permanently remove this folder and everything inside it."
          : "This will permanently remove this file.",
        detail: "This cannot be undone.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!confirmed) return;

      try {
        await fileSystem.delete(path, { recursive: isDirectory });
      } catch (cause) {
        const described = describeFileSystemError(cause, "It could not be deleted.");
        deps.logger.warn("delete-path failed", { path, detail: described.detail });
        deps.notify("error", `Could not delete ${name}`, described.message, described.detail);
        return;
      }

      deps.dispatch({ type: "pathRemoved", path });
      await collaborators.reloadDirectory(dirName(path));
    },
  };
}
