import { useAppState } from "../state/app-state";

/**
 * The terminal panel.
 *
 * ForgeAI deliberately has **no command execution** in Module 0. `CommandRunnerPort` and
 * `TerminalService` are interfaces only, so there is nothing for a terminal UI to attach to.
 * This panel exists to display that fact rather than to render a fake prompt.
 */
export function TerminalPanel() {
  const { config } = useAppState();

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-zinc-800 bg-zinc-950">
      <header className="flex h-8 shrink-0 items-center gap-3 border-b border-zinc-800 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Terminal</h2>
        <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-amber-500/80">
          disabled · Module 3
        </span>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="max-w-md text-center text-xs leading-relaxed text-zinc-500">
          Command execution is not implemented. Commands will be modelled as permission requests
          that must be approved before they run &mdash; ForgeAI never exposes an unrestricted
          shell. Agent iteration limit is currently{" "}
          <span className="font-mono text-zinc-400">{config.agent.maxIterations}</span>.
        </p>
      </div>
    </section>
  );
}
