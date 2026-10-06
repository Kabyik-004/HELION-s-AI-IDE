import { useAppState } from "../../../app/AppStateProvider";
import { useIde } from "../../../app/IdeProvider";
import { Button } from "../../../shared/ui/Button";
import { FileIcon, FolderIcon, FolderOpenIcon } from "../../../shared/ui/Icons";
import { RecentProjects } from "../../workspace/recent-projects/RecentProjects";

const SHORTCUTS: readonly (readonly [string, string])[] = [
  ["Ctrl+B", "side panel"],
  ["Ctrl+J", "bottom panel"],
  ["Ctrl+Shift+A", "AI assistant"],
  ["Ctrl+S", "save file"],
  ["F2", "rename (in explorer)"],
];

/**
 * Shown when no file is open.
 *
 * It offers a way back into the project rather than being purely decorative: the quick-open list is
 * read from the same directory cache the explorer uses, so this is real project data. With no folder
 * open at all, it becomes the "open a folder" surface.
 */
export function WelcomeView() {
  const { state, api } = useIde();
  const { services } = useAppState();
  const workspace = state.workspace.workspace;

  if (workspace === null) {
    return (
      <div className="flex h-full items-center justify-center overflow-auto p-8">
        <div className="w-full max-w-md text-center">
          <FolderOpenIcon size={26} className="mx-auto mb-3 text-ink-500" />
          <h1 className="text-base font-semibold text-ink-100">No folder is open</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">
            {services.workspace.pickerAvailable
              ? "Choose a folder to browse, edit and save its files."
              : "The browser preview has no folder picker, so it loads a built-in example project."}
          </p>

          <div className="mt-4 flex justify-center">
            <Button
              variant="primary"
              onClick={() => void api.workspace.openFromPicker()}
              disabled={!services.workspace.pickerAvailable}
              title={services.workspace.pickerAvailable ? undefined : "Requires the ForgeAI desktop app"}
            >
              Open Folder…
            </Button>
          </div>

          <div className="mt-6 text-left">
            <RecentProjects
              heading="Recent folders"
              onOpen={(path) => void api.workspace.openPath(path)}
            />
          </div>
        </div>
      </div>
    );
  }

  const entries = state.explorer.directories[workspace.path]?.entries ?? [];
  const quickFiles = entries.filter((entry) => entry.kind === "file").slice(0, 5);
  const quickDirectories = entries.filter((entry) => entry.kind === "directory").slice(0, 3);

  return (
    <div className="flex h-full items-center justify-center overflow-auto p-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-baseline gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent-500" aria-hidden />
          <h1 className="text-lg font-semibold tracking-tight text-ink-100">ForgeAI</h1>
          <span className="text-xs text-ink-400">An AI-native desktop IDE</span>
        </div>

        <section className="mb-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Folder</h2>
          <div className="rounded border border-ink-700 bg-ink-850 px-3 py-2">
            <p className="text-xs text-ink-200">{workspace.name}</p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-ink-500" title={workspace.path}>
              {workspace.path}
            </p>
          </div>
        </section>

        {quickFiles.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Open a file</h2>
            <ul className="space-y-0.5">
              {quickFiles.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => api.editor.openFile(entry.path)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-ink-300 transition-colors hover:bg-ink-850 hover:text-ink-100"
                  >
                    <FileIcon size={14} className="text-ink-400" />
                    <span className="truncate">{entry.name}</span>
                  </button>
                </li>
              ))}
              {quickDirectories.map((entry) => (
                <li key={entry.path}>
                  <button
                    type="button"
                    onClick={() => {
                      api.explorer.expandDirectory(entry.path);
                      api.panels.activateActivity("explorer");
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs text-ink-400 transition-colors hover:bg-ink-850 hover:text-ink-200"
                  >
                    <FolderIcon size={14} className="text-ink-500" />
                    <span className="truncate">{entry.name}/</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Panels</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {SHORTCUTS.map(([keys, description]) => (
              <div key={keys} className="contents">
                <dt className="font-mono text-[11px] text-ink-300">{keys}</dt>
                <dd className="text-[11px] text-ink-500">{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
