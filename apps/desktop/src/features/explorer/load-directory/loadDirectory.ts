import type { FeatureDeps } from "../../../app/featureContext";
import { describeFileSystemError } from "../../../shared/errors/describeFileSystemError";

/**
 * Read one directory and publish the result.
 *
 * This is the only place a directory listing is fetched. Everything that needs a fresh listing —
 * expanding a folder, refreshing, or reloading after a change — calls this, so the caching and
 * the hidden-file setting are applied consistently in one place.
 */
export interface LoadDirectoryFeature {
  /** Reads `path` and replaces its cached listing. Safe to call for any path. */
  loadDirectory(path: string): Promise<void>;
}

export function createLoadDirectoryFeature(deps: FeatureDeps): LoadDirectoryFeature {
  return {
    async loadDirectory(path: string): Promise<void> {
      const fileSystem = deps.fileSystem();
      if (fileSystem === null) return;

      const showHidden = deps.getState().explorer.showHiddenFiles;
      try {
        const listing = await fileSystem.readDirectory(path, { showHidden });
        deps.dispatch({ type: "listingLoaded", path, listing });
      } catch (cause) {
        const described = describeFileSystemError(cause, "The folder could not be read.");
        deps.logger.warn("load-directory failed", { path, detail: described.detail });
        deps.notify("error", "Could not read a folder", described.message, described.detail);
      }
    },
  };
}
