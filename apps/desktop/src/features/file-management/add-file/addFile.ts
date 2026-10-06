import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { joinPath } from "../../../shared/path/path";
import { validateEntryName } from "../shared/nameValidation";

/**
 * Create a file.
 *
 * Owns: the name prompt, validation, the create call, and create-specific error reporting.
 * Does not own: folder creation, renaming, deletion, or what happens to the new file afterwards.
 */
export interface AddFileFeature {
  addFile(directoryPath: string): Promise<void>;
}

/** Collaborators injected by the composition root, so this feature imports no other feature. */
export interface AddFileCollaborators {
  readonly reloadDirectory: (path: string) => Promise<void>;
  readonly openFile: (path: string) => void;
}

export function createAddFileFeature(deps: FeatureDeps, collaborators: AddFileCollaborators): AddFileFeature {
  return {
    async addFile(directoryPath: string): Promise<void> {
      const taken =
        deps.getState().explorer.directories[directoryPath]?.entries.map((entry) => entry.name) ?? [];

      const name = await deps.dialogs.prompt({
        title: "New File",
        label: "File name",
        initialValue: "",
        confirmLabel: "Create",
        placeholder: "component.tsx",
        validate: validateEntryName,
        taken,
      });
      if (name === null) return;

      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      const path = joinPath(directoryPath, name);
      try {
        await fileSystem.createFile(path);
      } catch (cause) {
        const described = describeFileSystemError(cause, "The file could not be created.");
        deps.logger.warn("add-file failed", { path, detail: described.detail });
        deps.notify("error", `Could not create ${name}`, described.message, described.detail);
        return;
      }

      await collaborators.reloadDirectory(directoryPath);
      collaborators.openFile(path);
    },
  };
}
