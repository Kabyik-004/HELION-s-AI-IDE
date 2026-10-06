import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { joinPath } from "../../../shared/path/path";
import { validateEntryName } from "../shared/nameValidation";

/**
 * Create a folder.
 *
 * Owns: the name prompt, validation, the create call, create-specific error reporting, and
 * selecting the result so the developer sees where it landed.
 * Does not own: file creation, renaming, deletion.
 */
export interface CreateFolderFeature {
  createFolder(directoryPath: string): Promise<void>;
}

export interface CreateFolderCollaborators {
  readonly reloadDirectory: (path: string) => Promise<void>;
}

export function createCreateFolderFeature(
  deps: FeatureDeps,
  collaborators: CreateFolderCollaborators,
): CreateFolderFeature {
  return {
    async createFolder(directoryPath: string): Promise<void> {
      const taken =
        deps.getState().explorer.directories[directoryPath]?.entries.map((entry) => entry.name) ?? [];

      const name = await deps.dialogs.prompt({
        title: "New Folder",
        label: "Folder name",
        initialValue: "",
        confirmLabel: "Create",
        placeholder: "components",
        validate: validateEntryName,
        taken,
      });
      if (name === null) return;

      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      const path = joinPath(directoryPath, name);
      try {
        await fileSystem.createDirectory(path);
      } catch (cause) {
        const described = describeFileSystemError(cause, "The folder could not be created.");
        deps.logger.warn("create-folder failed", { path, detail: described.detail });
        deps.notify("error", `Could not create ${name}`, described.message, described.detail);
        return;
      }

      deps.dispatch({ type: "pathSelected", path });
      await collaborators.reloadDirectory(directoryPath);
    },
  };
}
