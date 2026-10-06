import type { DirEntry } from "@forgeai/shared";
import { useEffect, type MouseEvent as ReactMouseEvent } from "react";

import { useIde } from "../../../app/IdeProvider";
import { tintForPath } from "../../../shared/language/language";
import { ChevronDownIcon, ChevronRightIcon, DotIcon, FileIcon, FolderIcon } from "../../../shared/ui/Icons";
import { isDirty } from "../../editor/editor.types";

const INDENT_PER_LEVEL = 12;
const BASE_PADDING = 6;

export interface FileTreeNodeProps {
  readonly entry: DirEntry;
  readonly depth: number;
  readonly onContextMenu: (entry: DirEntry, event: ReactMouseEvent) => void;
}

/**
 * One row in the file tree, plus its children when it is an expanded directory.
 *
 * The node never touches the file system: it asks the explorer or editor features to act, and they
 * decide whether a read is needed.
 */
export function FileTreeNode({ entry, depth, onContextMenu }: FileTreeNodeProps) {
  const { state, api } = useIde();
  const { explorer, editor } = state;

  const isDirectory = entry.kind === "directory";
  const expanded = explorer.expanded.includes(entry.path);
  const listing = explorer.directories[entry.path];
  const selected = explorer.selectedPath === entry.path;
  const active = editor.activeTabPath === entry.path;
  const dirty = !isDirectory && isDirty(editor.buffers[entry.path]);

  // Self-healing load: an expanded folder whose cached listing was dropped (after a rename, or a
  // change to the hidden-file setting) is read again rather than showing "Reading…" forever.
  useEffect(() => {
    if (isDirectory && expanded && listing === undefined) api.explorer.expandDirectory(entry.path);
  }, [isDirectory, expanded, listing, entry.path, api.explorer]);

  const activate = () => {
    if (isDirectory) {
      api.explorer.selectPath(entry.path);
      if (expanded) api.explorer.collapseDirectory(entry.path);
      else api.explorer.expandDirectory(entry.path);
      return;
    }
    api.editor.openFile(entry.path);
  };

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-expanded={isDirectory ? expanded : undefined}
        aria-selected={selected}
        aria-level={depth + 1}
        tabIndex={-1}
        title={entry.path}
        onClick={activate}
        onContextMenu={(event) => {
          event.preventDefault();
          // Without this the container's background menu would overwrite this one during bubbling,
          // and the operation would target the wrong path.
          event.stopPropagation();
          if (isDirectory) api.explorer.selectPath(entry.path);
          onContextMenu(entry, event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
          if (event.key === "F2") {
            event.preventDefault();
            void api.files.renamePath(entry.path);
          }
          if (event.key === "Delete") {
            event.preventDefault();
            void api.files.deletePath(entry.path);
          }
        }}
        style={{ paddingLeft: BASE_PADDING + depth * INDENT_PER_LEVEL }}
        className={[
          "flex cursor-pointer select-none items-center gap-1.5 rounded-sm py-[3px] pr-2 text-xs leading-5",
          selected || active ? "bg-ink-750 text-ink-100" : "text-ink-300 hover:bg-ink-800 hover:text-ink-100",
        ].join(" ")}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink-400">
          {isDirectory ? (
            expanded ? (
              <ChevronDownIcon size={13} />
            ) : (
              <ChevronRightIcon size={13} />
            )
          ) : null}
        </span>

        {isDirectory ? (
          <FolderIcon size={15} className="shrink-0 text-ink-300" />
        ) : (
          <FileIcon size={15} className={`shrink-0 ${tintForPath(entry.path)}`} />
        )}

        <span className="truncate">{entry.name}</span>
        {dirty && (
          <span className="ml-auto pl-2" title="Unsaved changes">
            <DotIcon size={10} className="text-accent-400" />
          </span>
        )}
      </div>

      {isDirectory && expanded && (
        <ul role="group">
          {listing === undefined ? (
            <li
              style={{ paddingLeft: BASE_PADDING + (depth + 1) * INDENT_PER_LEVEL }}
              className="py-[3px] text-[11px] italic text-ink-500"
            >
              Reading…
            </li>
          ) : listing.entries.length === 0 ? (
            <li
              style={{ paddingLeft: BASE_PADDING + (depth + 1) * INDENT_PER_LEVEL }}
              className="py-[3px] text-[11px] italic text-ink-500"
            >
              Empty
            </li>
          ) : (
            listing.entries.map((child) => (
              <FileTreeNode key={child.path} entry={child} depth={depth + 1} onContextMenu={onContextMenu} />
            ))
          )}
        </ul>
      )}
    </li>
  );
}
