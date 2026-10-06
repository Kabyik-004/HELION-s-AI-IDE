import { useIde } from "../../../app/IdeProvider";
import { TerminalIcon } from "../../../shared/ui/Icons";

/**
 * Terminal view.
 *
 * ForgeAI has no command execution: `CommandRunnerPort` and `TerminalService` are interfaces only,
 * and nothing in the codebase spawns a process. This view says so rather than rendering a prompt
 * that would quietly do nothing.
 */
export function TerminalView() {
  const { state } = useIde();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <TerminalIcon size={20} className="mx-auto mb-2 text-ink-500" />
          <p className="text-xs text-ink-300">No terminal session</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
            Commands will be modelled as permission requests that must be approved before they run.
            ForgeAI never exposes an unrestricted shell.
          </p>
          <p className="mt-2 inline-block rounded border border-ink-700 bg-ink-850 px-2 py-0.5 font-mono text-[10px] text-accent-400/90">
            Module 4
          </p>
        </div>
      </div>

      <footer className="shrink-0 border-t border-ink-700/70 px-3 py-1.5 font-mono text-[10px] text-ink-500">
        0 sessions · {state.workspace.workspace?.name ?? "no folder"}
      </footer>
    </div>
  );
}
