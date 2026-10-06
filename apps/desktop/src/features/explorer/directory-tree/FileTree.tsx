import type { DirEntry } from "@forgeai/shared";
import type { MouseEvent as ReactMouseEvent } from "react";

import { useIde } from "../../../app/IdeProvider";
import { FileTreeNode } from "./FileTreeNode";

export interface FileTreeProps {
  readonly onContextMenu: (entry: DirEntry, event: ReactMouseEvent) => void;
}

/**
 * Renders the project tree for the open workspace.
 *
 * Only the root is read up front; every directory below it is loaded when it is expanded, so
 * opening a large repository costs one directory read rather than a full recursive walk.
 */
export function FileTree({ onContextMenu }: FileTreeProps) {
  const { state } = useIde();
  const workspace = state.workspace.workspace;

  if (workspace === null) return null;

  const listing = state.explorer.directories[workspace.path];

  if (listing === undefined) {
    return <p className="px-3 py-2 text-[11px] italic text-ink-500">Reading folder…</p>;
  }

  if (listing.entries.length === 0) {
    return (
      <p className="px-3 py-2 text-[11px] italic text-ink-500">
        This folder is empty. Use the toolbar to add a file or a folder.
      </p>
    );
  }

  return (
    <>
      <ul role="tree" aria-label="Project files" className="pb-1">
        {listing.entries.map((entry) => (
          <FileTreeNode key={entry.path} entry={entry} depth={0} onContextMenu={onContextMenu} />
        ))}
      </ul>
      {listing.truncated && (
        <p className="px-3 py-2 text-[10px] italic text-warning-500">
          This folder holds more entries than ForgeAI lists at once, so the list is cut short.
        </p>
      )}
    </>
  );
}
