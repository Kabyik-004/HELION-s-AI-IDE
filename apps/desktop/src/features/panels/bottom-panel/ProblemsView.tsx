import { useIde } from "../../../app/IdeProvider";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { ErrorIcon, InfoIcon, WarningIcon } from "../../../shared/ui/Icons";

const SEVERITY_ICON = {
  error: ErrorIcon,
  warning: WarningIcon,
  info: InfoIcon,
} as const;

const SEVERITY_CLASS = {
  error: "text-danger-500",
  warning: "text-warning-500",
  info: "text-info-500",
} as const;

/**
 * Problems view.
 *
 * Fed by Monaco's own marker API (see the editor surface), so these are real diagnostics from the
 * language workers, not placeholder rows.
 */
export function ProblemsView() {
  const { state, api } = useIde();
  const { problems } = state.editor;

  if (problems.length === 0) {
    return (
      <EmptyState
        title="No problems"
        description="Diagnostics reported by the editor's language services will appear here."
      />
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-auto py-1">
      {problems.map((problem, index) => {
        const SeverityIcon = SEVERITY_ICON[problem.severity];
        return (
          <li key={`${problem.path}:${problem.line}:${problem.column}:${index}`}>
            <button
              type="button"
              onClick={() => {
                // Opening the file is enough today; revealing the exact position needs a Monaco
                // API call that belongs with the editor commands in a later module.
                api.editor.openFile(problem.path);
              }}
              className="flex w-full items-start gap-2 px-3 py-1 text-left text-[11px] leading-relaxed text-ink-300 transition-colors hover:bg-ink-850"
            >
              <SeverityIcon size={13} className={`mt-px shrink-0 ${SEVERITY_CLASS[problem.severity]}`} />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2">{problem.message}</span>
                <span className="mt-0.5 block truncate font-mono text-[10px] text-ink-500">
                  {problem.path}:{problem.line}:{problem.column}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
