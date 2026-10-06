import { useIde } from "../../../app/IdeProvider";
import { tintForPath } from "../../../shared/language/language";
import { CloseIcon, DotIcon, FileIcon } from "../../../shared/ui/Icons";
import { isDirty } from "../editor.types";

/** The open-editor strip. One tab per file, with an unsaved-changes indicator. */
export function EditorTabs() {
  const { state, api } = useIde();
  const { editor } = state;

  return (
    <div
      role="tablist"
      aria-label="Open editors"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-ink-700 bg-ink-900"
    >
      {editor.tabs.map((tab) => {
        const active = editor.activeTabPath === tab.path;
        const dirty = isDirty(editor.buffers[tab.path]);
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            title={tab.path}
            onClick={() => api.editor.activateTab(tab.path)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                api.editor.activateTab(tab.path);
              }
            }}
            // Middle-click closes, matching every other editor.
            onAuxClick={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                void api.editor.requestClose(tab.path);
              }
            }}
            className={[
              "group relative flex max-w-56 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 border-r border-ink-700/70 px-2.5 text-xs",
              active ? "bg-ink-950 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200",
            ].join(" ")}
          >
            {active && <span className="absolute inset-x-0 top-0 h-px bg-accent-500" aria-hidden />}
            <FileIcon size={13} className={`shrink-0 ${tintForPath(tab.path)}`} />
            <span className="truncate">{tab.name}</span>
            {dirty && (
              <span className="shrink-0 text-accent-400" title="Unsaved changes">
                <DotIcon size={10} />
              </span>
            )}
            <button
              type="button"
              aria-label={`Close ${tab.name}`}
              title={`Close ${tab.name} (Ctrl+W)`}
              onClick={(event) => {
                event.stopPropagation();
                void api.editor.requestClose(tab.path);
              }}
              className="ml-0.5 shrink-0 rounded p-0.5 text-ink-500 opacity-0 transition-opacity hover:bg-ink-700 hover:text-ink-100 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <CloseIcon size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
