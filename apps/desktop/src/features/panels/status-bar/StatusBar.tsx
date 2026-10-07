import { useAppState } from "../../../app/AppStateProvider";
import { useIde } from "../../../app/IdeProvider";
import { isDirty } from "../../editor/editor.types";
import { ErrorIcon, InfoIcon, WarningIcon } from "../../../shared/ui/Icons";

/**
 * The status bar: which folder is open, what the editor is doing, and how ForgeAI itself is
 * configured. Everything here reflects real state — nothing is a decorative label.
 */
export function StatusBar() {
  const { state, api } = useIde();
  const { config, appInfo, services } = useAppState();

  const { editor, workspace } = state;
  const errors = editor.problems.filter((problem) => problem.severity === "error").length;
  const warnings = editor.problems.filter((problem) => problem.severity === "warning").length;
  const activeBuffer = editor.activeTabPath === null ? undefined : editor.buffers[editor.activeTabPath];
  const unsaved = Object.values(editor.buffers).filter((buffer) => isDirty(buffer)).length;

  const runtime = appInfo === undefined ? "browser preview" : `v${appInfo.version}`;
  const activeProvider = config.provider.instances.find(
    (instance) => instance.id === config.provider.selectedProviderId,
  );

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-ink-700 bg-ink-900 px-2.5 font-mono text-[10px] text-ink-400">
      <span className="truncate text-ink-300" title={workspace.workspace?.path}>
        {workspace.workspace?.name ?? "no folder"}
      </span>
      {!services.native && (
        <span
          className="rounded border border-ink-700 px-1.5 text-[9px] text-ink-400"
          title="Running in a browser: files come from a built-in example project, and settings are not persisted."
        >
          example project
        </span>
      )}
      <span title="Git integration arrives in a later module">no repository</span>
      {unsaved > 0 && <span className="text-accent-400">{unsaved} unsaved</span>}

      <button
        type="button"
        onClick={() => api.panels.toggleBottomView("problems")}
        title="Show problems"
        className="ml-auto flex items-center gap-1 rounded px-1 hover:bg-ink-750 hover:text-ink-200"
      >
        <ErrorIcon size={12} className={errors > 0 ? "text-danger-500" : "text-ink-500"} />
        <span>{errors}</span>
        <WarningIcon size={12} className={warnings > 0 ? "text-warning-500" : "text-ink-500"} />
        <span>{warnings}</span>
      </button>

      {activeBuffer !== undefined && (
        <>
          <span>{activeBuffer.language}</span>
          <span>
            Ln {editor.cursor.line}, Col {editor.cursor.column}
          </span>
        </>
      )}

      <span className="flex items-center gap-1" title="Selected AI provider and model">
        <InfoIcon size={12} className="text-ink-500" />
        {activeProvider?.displayName ?? "no provider"} / {activeProvider?.model ?? "no model"}
      </span>
      <span className="text-accent-400/90">{runtime}</span>
    </footer>
  );
}
