import type { ReactNode } from "react";

import { useIde } from "../../../app/IdeProvider";
import { IconButton } from "../../../shared/ui/IconButton";
import { CloseIcon, ErrorIcon, TerminalIcon, WarningIcon } from "../../../shared/ui/Icons";
import { ProblemsView } from "./ProblemsView";
import { TerminalView } from "./TerminalView";

/** The bottom dock: Terminal and Problems, with a button to dismiss it. */
export function BottomPanel() {
  const { state, api } = useIde();
  const { bottomView } = state.layout;
  const { problems } = state.editor;

  const errors = problems.filter((problem) => problem.severity === "error").length;
  const warnings = problems.filter((problem) => problem.severity === "warning").length;

  return (
    <section aria-label="Panel" className="flex h-full min-h-0 flex-col border-t border-ink-700/70 bg-ink-900">
      <header className="flex h-8 shrink-0 items-center border-b border-ink-700/70 px-1.5">
        <div role="tablist" aria-label="Panel views" className="flex items-center gap-0.5">
          <PanelTab
            active={bottomView === "terminal"}
            onClick={() => api.panels.toggleBottomView("terminal")}
            icon={<TerminalIcon size={13} />}
            label="Terminal"
          />
          <PanelTab
            active={bottomView === "problems"}
            onClick={() => api.panels.toggleBottomView("problems")}
            icon={<ErrorIcon size={13} />}
            label="Problems"
            badge={
              errors + warnings > 0 ? (
                <span className="ml-1 flex items-center gap-1 font-mono text-[10px]">
                  {errors > 0 && (
                    <span className="flex items-center gap-0.5 text-danger-500">
                      <ErrorIcon size={10} />
                      {errors}
                    </span>
                  )}
                  {warnings > 0 && (
                    <span className="flex items-center gap-0.5 text-warning-500">
                      <WarningIcon size={10} />
                      {warnings}
                    </span>
                  )}
                </span>
              ) : null
            }
          />
        </div>

        <div className="ml-auto">
          <IconButton label="Hide panel (Ctrl+J)" size="sm" onClick={api.panels.toggleBottom}>
            <CloseIcon size={14} />
          </IconButton>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {bottomView === "terminal" ? <TerminalView /> : <ProblemsView />}
      </div>
    </section>
  );
}

interface PanelTabProps {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly icon: ReactNode;
  readonly label: string;
  readonly badge?: ReactNode;
}

function PanelTab({ active, onClick, icon, label, badge }: PanelTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded px-2 py-1 text-[11px] uppercase tracking-wide transition-colors",
        active ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:bg-ink-850 hover:text-ink-200",
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
      {badge}
    </button>
  );
}
