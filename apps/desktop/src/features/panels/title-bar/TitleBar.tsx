import { useMemo, useState } from "react";

import { useAppState } from "../../../app/AppStateProvider";
import { useIde, type IdeApi } from "../../../app/IdeProvider";
import { baseName, dirName } from "../../../shared/path/path";
import { IconButton } from "../../../shared/ui/IconButton";
import { PanelBottomIcon, PanelLeftIcon, PanelRightIcon, SettingsIcon } from "../../../shared/ui/Icons";
import { isDirty } from "../../editor/editor.types";
import type { IdeState } from "../../../app/ideTypes";
import { Dialog } from "../../../shared/ui/Dialog";
import { MenuBar, type MenuDefinition } from "./MenuBar";

type DialogKind = "about" | "shortcuts" | null;

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["Ctrl + B", "Show or hide the side panel"],
  ["Ctrl + J", "Show or hide the bottom panel"],
  ["Ctrl + Shift + A", "Show or hide the AI assistant"],
  ["Ctrl + Shift + O", "Focus the explorer"],
  ["Ctrl + S", "Save the active file"],
  ["Ctrl + W", "Close the active editor"],
  ["F2", "Rename the selected file or folder"],
  ["Delete", "Delete the selected file or folder"],
];

/**
 * The application menu bar and window-level controls.
 *
 * The menu contents are built from the feature APIs, so a menu item is a call into the feature that
 * owns the behaviour rather than an implementation of it.
 */
export function TitleBar() {
  const { state, api } = useIde();
  const { appInfo, config, services } = useAppState();
  const [dialog, setDialog] = useState<DialogKind>(null);

  const menus = useMemo<readonly MenuDefinition[]>(
    () =>
      buildMenus(state, api, {
        recents: config.project.recentProjects,
        pickerAvailable: services.workspace.pickerAvailable,
        openDialog: setDialog,
      }),
    [state, api, config.project.recentProjects, services.workspace.pickerAvailable, appInfo],
  );

  const { editor, layout, workspace } = state;
  const activeBuffer = editor.activeTabPath === null ? undefined : editor.buffers[editor.activeTabPath];

  return (
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-ink-700 bg-ink-900 pl-2.5 pr-1.5">
      <div className="flex items-center gap-1.5 pr-1">
        <span className="h-2 w-2 rounded-sm bg-accent-500" aria-hidden />
        <span className="text-xs font-semibold tracking-wide text-ink-100">ForgeAI</span>
      </div>

      <MenuBar menus={menus} />

      <div className="ml-auto flex items-center gap-1">
        <span
          className="hidden max-w-56 truncate font-mono text-[10px] text-ink-400 md:inline"
          title={workspace.workspace?.path}
        >
          {workspace.workspace === null ? "no folder" : workspace.workspace.name}
          {activeBuffer !== undefined && isDirty(activeBuffer) ? " •" : ""}
        </span>
        <IconButton
          label="Toggle side panel (Ctrl+B)"
          active={layout.sidebarVisible}
          onClick={api.panels.toggleSidebar}
        >
          <PanelLeftIcon />
        </IconButton>
        <IconButton label="Toggle panel (Ctrl+J)" active={layout.bottomVisible} onClick={api.panels.toggleBottom}>
          <PanelBottomIcon />
        </IconButton>
        <IconButton
          label="Toggle AI assistant (Ctrl+Shift+A)"
          active={layout.aiVisible}
          onClick={api.panels.toggleAi}
        >
          <PanelRightIcon />
        </IconButton>
        <IconButton
          label="Settings"
          active={layout.activity === "settings" && layout.sidebarVisible}
          onClick={() => api.panels.activateActivity("settings")}
        >
          <SettingsIcon />
        </IconButton>
      </div>

      {dialog === "shortcuts" && (
        <Dialog title="Keyboard shortcuts" onClose={() => setDialog(null)}>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5">
            {SHORTCUTS.map(([keys, description]) => (
              <div key={keys} className="contents">
                <dt className="font-mono text-[11px] text-ink-200">{keys}</dt>
                <dd className="text-ink-400">{description}</dd>
              </div>
            ))}
          </dl>
        </Dialog>
      )}

      {dialog === "about" && (
        <Dialog title="About ForgeAI" onClose={() => setDialog(null)}>
          <p className="mb-2 text-ink-200">An AI-native desktop IDE.</p>
          <p className="text-ink-400">
            Open a folder to browse, edit and save its files. AI providers, terminals and Git
            integration arrive in later modules.
          </p>
          <p className="mt-3 font-mono text-[10px] text-ink-400">
            build: {appInfo === undefined ? "browser preview" : `${appInfo.name} ${appInfo.version}`}
          </p>
        </Dialog>
      )}
    </header>
  );
}

interface MenuContext {
  readonly recents: readonly string[];
  readonly pickerAvailable: boolean;
  readonly openDialog: (kind: DialogKind) => void;
}

function buildMenus(state: IdeState, api: IdeApi, context: MenuContext): readonly MenuDefinition[] {
  const { editor, explorer, layout, workspace } = state;

  /** The folder a new item should be created in: the selected folder, else the selected file's parent. */
  const targetDirectory = (): string => {
    if (workspace.workspace === null) return "";
    const selected = explorer.selectedPath;
    if (selected === null) return workspace.workspace.path;
    const parent = dirName(selected);
    const entry = explorer.directories[parent]?.entries.find((candidate) => candidate.path === selected);
    return entry?.kind === "directory" ? selected : parent;
  };

  const selectedPath = explorer.selectedPath ?? editor.activeTabPath;
  const activeBuffer = editor.activeTabPath === null ? undefined : editor.buffers[editor.activeTabPath];
  const hasDirtyBuffers = Object.values(editor.buffers).some((buffer) => isDirty(buffer));
  const hasTabs = editor.tabs.length > 0;
  const hasActiveTab = editor.activeTabPath !== null;

  return [
    {
      label: "Project",
      items: [
        {
          label: "Open Folder…",
          disabled: !context.pickerAvailable,
          reason: context.pickerAvailable ? undefined : "The browser preview cannot open folders",
          onSelect: () => void api.workspace.openFromPicker(),
        },
        {
          label: "Close Folder",
          disabled: workspace.workspace === null,
          reason: "No folder is open",
          onSelect: () => void api.workspace.closeProject(),
        },
        ...context.recents.slice(0, 5).map((path) => ({
          label: `Recent: ${baseName(path)}`,
          onSelect: () => void api.workspace.openPath(path),
        })),
      ],
    },
    {
      label: "File",
      items: [
        {
          label: "New File…",
          disabled: workspace.workspace === null,
          reason: "Open a folder first",
          onSelect: () => void api.files.addFile(targetDirectory()),
        },
        {
          label: "New Folder…",
          disabled: workspace.workspace === null,
          reason: "Open a folder first",
          onSelect: () => void api.files.createFolder(targetDirectory()),
        },
        {
          label: "Rename…",
          shortcut: "F2",
          disabled: selectedPath === null,
          reason: "Select a file or folder in the explorer",
          onSelect: () => {
            if (selectedPath !== null) void api.files.renamePath(selectedPath);
          },
        },
        {
          label: "Delete",
          disabled: selectedPath === null,
          reason: "Select a file or folder in the explorer",
          onSelect: () => {
            if (selectedPath !== null) void api.files.deletePath(selectedPath);
          },
        },
        {
          label: "Save",
          shortcut: "Ctrl+S",
          disabled: !hasActiveTab || !isDirty(activeBuffer),
          reason: hasActiveTab ? "This file has no unsaved changes" : "No file is open",
          onSelect: () => {
            if (editor.activeTabPath !== null) void api.editor.saveFile(editor.activeTabPath);
          },
        },
        {
          label: "Save All",
          disabled: !hasDirtyBuffers,
          reason: "No files have unsaved changes",
          onSelect: () => void api.editor.saveAllFiles(),
        },
        {
          label: "Close Editor",
          shortcut: "Ctrl+W",
          disabled: !hasActiveTab,
          reason: "No file is open",
          onSelect: () => {
            if (editor.activeTabPath !== null) void api.editor.requestClose(editor.activeTabPath);
          },
        },
        {
          label: "Close All Editors",
          disabled: !hasTabs,
          reason: "No files are open",
          onSelect: () => void api.editor.closeAllTabs(),
        },
      ],
    },
    {
      label: "View",
      items: [
        {
          label: "Explorer",
          shortcut: "Ctrl+Shift+O",
          checked: layout.sidebarVisible && layout.activity === "explorer",
          onSelect: () => api.panels.activateActivity("explorer"),
        },
        {
          label: "Side panel",
          shortcut: "Ctrl+B",
          checked: layout.sidebarVisible,
          onSelect: api.panels.toggleSidebar,
        },
        { label: "Panel", shortcut: "Ctrl+J", checked: layout.bottomVisible, onSelect: api.panels.toggleBottom },
        {
          label: "AI assistant",
          shortcut: "Ctrl+Shift+A",
          checked: layout.aiVisible,
          onSelect: api.panels.toggleAi,
        },
        {
          label: "Show hidden files",
          checked: explorer.showHiddenFiles,
          disabled: workspace.workspace === null,
          reason: "Open a folder first",
          onSelect: () => void api.explorer.toggleShowHiddenFiles(),
        },
        { label: "Reset layout", onSelect: api.panels.resetLayout },
      ],
    },
    {
      label: "Terminal",
      items: [
        {
          label: "New Terminal",
          disabled: true,
          reason: "Command execution is permission-gated and arrives in Module 4",
        },
        {
          label: "Toggle Panel",
          shortcut: "Ctrl+J",
          checked: layout.bottomVisible,
          onSelect: api.panels.toggleBottom,
        },
        {
          label: "Problems",
          checked: layout.bottomVisible && layout.bottomView === "problems",
          onSelect: () => api.panels.toggleBottomView("problems"),
        },
      ],
    },
    {
      label: "Help",
      items: [
        { label: "Keyboard Shortcuts", onSelect: () => context.openDialog("shortcuts") },
        { label: "About ForgeAI", onSelect: () => context.openDialog("about") },
      ],
    },
  ];
}
