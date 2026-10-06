import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";

import { FileSystemError } from "@forgeai/shared";
import type { FileSystemPort, Logger } from "@forgeai/shared";

import { backend } from "../ipc/backend";
import { EXAMPLE_PROJECT_NAME, EXAMPLE_PROJECT_ROOT, ExampleFileSystem } from "./exampleFileSystem";
import { TauriFileSystem } from "./tauriFileSystem";

/** The folder ForgeAI currently has open. */
export interface Workspace {
  /** Absolute path of the root. */
  readonly path: string;
  /** Last path segment, used as the display name. */
  readonly name: string;
}

/**
 * Owns which folder is open and hands out the file system bound to it.
 *
 * Keeping this in one place is what makes "the workspace" a single concept: when the folder
 * changes, the backend's root and the path mapping change together, so the rest of the
 * application only ever asks for `fileSystem()`.
 *
 * There are two implementations because ForgeAI runs in two environments — see
 * `createWorkspaceService`.
 */
export interface WorkspaceService {
  /** True when a native folder picker is available (i.e. running under Tauri). */
  readonly pickerAvailable: boolean;
  current(): Workspace | null;
  /** Shows the native folder picker. Resolves to `null` when the user cancels. */
  pick(): Promise<Workspace | null>;
  /** Opens a known absolute path. */
  open(path: string): Promise<Workspace>;
  close(): Promise<void>;
  /** The file system for the current workspace. Throws when no folder is open. */
  fileSystem(): FileSystemPort;
}

const NO_WORKSPACE = "No folder is open. Open a folder to browse its files.";

/**
 * The desktop implementation: the folder picker is native, and every file operation goes to the
 * Rust backend, which confines it to the open folder.
 */
function createNativeWorkspaceService(logger: Logger): WorkspaceService {
  let open: { readonly info: Workspace; readonly fs: FileSystemPort } | null = null;

  const openPath = async (path: string): Promise<Workspace> => {
    // The backend canonicalises the path and becomes the authority on the root, so the frontend
    // uses the value it returns rather than the one the dialog provided.
    const info = await backend.openWorkspace(path);
    const workspace: Workspace = { path: info.path, name: info.name };
    open = { info: workspace, fs: new TauriFileSystem(info.path) };
    logger.info("workspace opened", { path: workspace.path });
    return workspace;
  };

  return {
    pickerAvailable: true,
    current: () => open?.info ?? null,
    async pick() {
      const selected = await openFolderDialog({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });
      if (selected === null || Array.isArray(selected)) return null;
      return openPath(selected);
    },
    open: openPath,
    async close() {
      await backend.closeWorkspace();
      open = null;
    },
    fileSystem() {
      if (open === null) throw new FileSystemError("noWorkspace", NO_WORKSPACE);
      return open.fs;
    },
  };
}

/**
 * The browser implementation, used by `npm run dev:web` and the end-to-end tests.
 *
 * A native folder picker does not exist outside the desktop shell, so the bundled in-memory
 * example project is opened instead. That keeps the whole interface — explorer, editor, dialogs,
 * file operations — exercisable in a browser without pretending native access exists.
 */
function createExampleWorkspaceService(): WorkspaceService {
  const fs = new ExampleFileSystem(EXAMPLE_PROJECT_ROOT);
  const info: Workspace = { path: EXAMPLE_PROJECT_ROOT, name: EXAMPLE_PROJECT_NAME };
  let open = true;

  return {
    pickerAvailable: false,
    current: () => (open ? info : null),
    async pick() {
      throw new FileSystemError(
        "noWorkspace",
        "Choosing a folder needs the ForgeAI desktop app. The browser preview shows a built-in example project instead.",
      );
    },
    async open(path: string) {
      if (path !== EXAMPLE_PROJECT_ROOT) {
        throw new FileSystemError("noWorkspace", "The browser preview can only open its example project.");
      }
      open = true;
      return info;
    },
    async close() {
      open = false;
    },
    fileSystem() {
      if (!open) throw new FileSystemError("noWorkspace", NO_WORKSPACE);
      return fs;
    },
  };
}

/** Chooses the implementation for the current environment. */
export function createWorkspaceService(native: boolean, logger: Logger): WorkspaceService {
  return native ? createNativeWorkspaceService(logger) : createExampleWorkspaceService();
}
