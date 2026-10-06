import type { EntryKind } from "@forgeai/shared";

import type { ContextMenuItem } from "../../../shared/ui/ContextMenu";
import { FileIcon, FolderPlusIcon, PencilIcon, TrashIcon } from "../../../shared/ui/Icons";

/**
 * The right-click menu entries for a file or folder.
 *
 * These live with the file-management operations rather than in the explorer, because they are the
 * operations' own entry points. The explorer only decides *when* to show a menu; this module
 * decides what is on it.
 */
export interface FileOperationCommands {
  readonly openFile: (path: string) => void;
  readonly addFile: (directoryPath: string) => void;
  readonly createFolder: (directoryPath: string) => void;
  readonly renamePath: (path: string) => void;
  readonly deletePath: (path: string) => void;
}

export function fileOperationMenuItems(
  entry: { readonly path: string; readonly kind: EntryKind },
  commands: FileOperationCommands,
): readonly ContextMenuItem[] {
  const rename: ContextMenuItem = {
    label: "Rename…",
    icon: <PencilIcon size={13} />,
    shortcut: "F2",
    onSelect: () => commands.renamePath(entry.path),
  };
  const remove: ContextMenuItem = {
    label: "Delete",
    icon: <TrashIcon size={13} />,
    destructive: true,
    onSelect: () => commands.deletePath(entry.path),
  };

  if (entry.kind === "directory") {
    return [
      {
        label: "New File…",
        icon: <FileIcon size={13} />,
        onSelect: () => commands.addFile(entry.path),
      },
      {
        label: "New Folder…",
        icon: <FolderPlusIcon size={13} />,
        onSelect: () => commands.createFolder(entry.path),
      },
      rename,
      remove,
    ];
  }

  return [
    { label: "Open", icon: <FileIcon size={13} />, onSelect: () => commands.openFile(entry.path) },
    rename,
    remove,
  ];
}
