import type { DirEntry } from "@forgeai/shared";
import { useState, type MouseEvent as ReactMouseEvent } from "react";

import { useAppState } from "../../../app/AppStateProvider";
import { useIde } from "../../../app/IdeProvider";
import { dirName } from "../../../shared/path/path";
import { Button } from "../../../shared/ui/Button";
import { ContextMenu, type ContextMenuState } from "../../../shared/ui/ContextMenu";
import { IconButton } from "../../../shared/ui/IconButton";
import { PanelHeader } from "../../../shared/ui/PanelHeader";
import {
  CollapseAllIcon,
  EyeIcon,
  EyeOffIcon,
  FileIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  RefreshIcon,
} from "../../../shared/ui/Icons";
import { fileOperationMenuItems } from "../../file-management/shared/fileOperationsMenu";
import { FileTree } from "../directory-tree/FileTree";
import { RecentProjects } from "../../workspace/recent-projects/RecentProjects";

/**
 * The project explorer.
 *
 * Orchestrator only: it decides where the toolbar sits, when a context menu opens, and what the
 * empty state says. What each menu entry *does* belongs to the file-management features, and the
 * tree itself belongs to `directory-tree`.
 */
export function ExplorerPanel() {
  const { state, api } = useIde();
  const { services } = useAppState();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);

  const workspace = state.workspace.workspace;
  const selected = state.explorer.selectedPath;

  /** Whether the selected path is a folder, resolved from the listing it was rendered from. */
  const selectedIsDirectory = (): boolean => {
    if (selected === null) return false;
    const parent = dirName(selected);
    const entry = state.explorer.directories[parent]?.entries.find((candidate) => candidate.path === selected);
    return entry?.kind === "directory";
  };

  /** Where a new file or folder goes: inside the selected folder, beside a file, else the root. */
  const targetDirectory = (): string => {
    if (workspace === null) return "";
    if (selected === null) return workspace.path;
    return selectedIsDirectory() ? selected : dirName(selected);
  };

  const commands = {
    openFile: api.editor.openFile,
    addFile: (directoryPath: string) => void api.files.addFile(directoryPath),
    createFolder: (directoryPath: string) => void api.files.createFolder(directoryPath),
    renamePath: (path: string) => void api.files.renamePath(path),
    deletePath: (path: string) => void api.files.deletePath(path),
  };

  const openNodeMenu = (entry: DirEntry, event: ReactMouseEvent) => {
    api.explorer.selectPath(entry.path);
    setMenu({ x: event.clientX, y: event.clientY, items: fileOperationMenuItems(entry, commands) });
  };

  const openBackgroundMenu = (event: ReactMouseEvent) => {
    if (workspace === null) return;
    event.preventDefault();
    setMenu({
      x: event.clientX,
      y: event.clientY,
      items: fileOperationMenuItems({ path: targetDirectory(), kind: "directory" }, commands),
    });
  };

  /* ------------------------------------------------------------------ no folder is open -- */

  if (workspace === null) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <PanelHeader>Explorer</PanelHeader>
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-auto px-4 py-6 text-center">
          <FolderOpenIcon size={22} className="text-ink-500" />
          <p className="text-xs font-medium text-ink-200">No folder is open</p>
          <p className="text-[11px] leading-relaxed text-ink-500">
            {services.workspace.pickerAvailable
              ? "Open a folder to browse and edit its files."
              : "The browser preview cannot open folders, so it uses a built-in example project instead."}
          </p>
          <Button
            variant="primary"
            onClick={() => void api.workspace.openFromPicker()}
            disabled={!services.workspace.pickerAvailable}
            title={services.workspace.pickerAvailable ? undefined : "Requires the ForgeAI desktop app"}
          >
            Open Folder…
          </Button>

          <div className="mt-3 w-full">
            <RecentProjects onOpen={(path) => void api.workspace.openPath(path)} />
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ explorer body -- */

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        actions={
          <>
            <IconButton label="New file" size="sm" onClick={() => void api.files.addFile(targetDirectory())}>
              <FileIcon size={14} />
            </IconButton>
            <IconButton label="New folder" size="sm" onClick={() => void api.files.createFolder(targetDirectory())}>
              <FolderPlusIcon size={14} />
            </IconButton>
            <IconButton label="Refresh" size="sm" onClick={() => void api.explorer.refreshTree()}>
              <RefreshIcon size={14} />
            </IconButton>
            <IconButton label="Collapse all folders" size="sm" onClick={api.explorer.collapseAllDirectories}>
              <CollapseAllIcon size={14} />
            </IconButton>
            <IconButton
              label={state.explorer.showHiddenFiles ? "Hide dot-files" : "Show dot-files"}
              size="sm"
              active={state.explorer.showHiddenFiles}
              onClick={() => void api.explorer.toggleShowHiddenFiles()}
            >
              {state.explorer.showHiddenFiles ? <EyeIcon size={14} /> : <EyeOffIcon size={14} />}
            </IconButton>
          </>
        }
      >
        {workspace.name}
      </PanelHeader>

      <div className="min-h-0 flex-1 overflow-auto" onContextMenu={openBackgroundMenu}>
        <FileTree onContextMenu={openNodeMenu} />
      </div>

      <footer className="shrink-0 border-t border-ink-700/70 px-3 py-1.5">
        <p className="truncate font-mono text-[10px] text-ink-500" title={workspace.path}>
          {workspace.path}
        </p>
      </footer>

      {menu !== null && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
    </div>
  );
}
