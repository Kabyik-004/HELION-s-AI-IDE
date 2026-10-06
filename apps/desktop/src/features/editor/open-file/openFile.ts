import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";
import { languageForPath } from "../../../shared/language/language";
import { readFile } from "../../file-management/read-file/readFile";

/**
 * Open a file into a tab.
 *
 * Owns: creating/focusing the tab, loading the buffer, and turning the result into the right
 * buffer state (`text`, `binary`, `tooLarge`).
 * Does not own: writing, closing, or unsaved-change prompts.
 *
 * Depends on `read-file` — a leaf feature with no dependencies of its own — so the read path is
 * shared rather than reimplemented here. The dependency is one-way and documented in the README.
 */
export interface OpenFileFeature {
  openFile(path: string): void;
}

export function createOpenFileFeature(deps: FeatureDeps): OpenFileFeature {
  return {
    openFile(path: string): void {
      deps.dispatch({ type: "tabOpened", path });
      deps.dispatch({ type: "pathSelected", path });

      // Already loaded and healthy: focusing the tab is the whole operation.
      const existing = deps.getState().editor.buffers[path];
      if (existing !== undefined && existing.error === undefined && !existing.loading) return;

      deps.dispatch({ type: "bufferLoading", path, language: languageForPath(path) });

      const fileSystem = deps.fileSystem();
      if (fileSystem === null) {
        deps.dispatch({ type: "bufferFailed", path, message: "No folder is open." });
        return;
      }

      void (async () => {
        try {
          const result = await readFile(fileSystem, path);
          if (result.kind === "text") {
            deps.dispatch({
              type: "bufferLoaded",
              path,
              content: result.text,
              size: result.size,
              modifiedAt: result.modifiedAt,
            });
          } else {
            deps.dispatch({ type: "bufferUnavailable", path, kind: result.kind, size: result.size });
          }
        } catch (cause) {
          const described = describeFileSystemError(cause, "The file could not be read.");
          deps.dispatch({ type: "bufferFailed", path, message: described.message });
          deps.notify("error", "Could not open a file", described.message, described.detail);
        }
      })();
    },
  };
}
