import { useAppState } from "../../../app/AppStateProvider";
import { baseName } from "../../../shared/path/path";
import { FolderIcon } from "../../../shared/ui/Icons";

/**
 * The recently opened folders list.
 *
 * Owns: presenting the history and reporting which entry was chosen.
 * Does not own: opening a folder (the caller does that) or storing the list (the config service
 * does).
 */
export function RecentProjects({
  onOpen,
  heading = "Recent",
}: {
  readonly onOpen: (path: string) => void;
  readonly heading?: string;
}) {
  const { config } = useAppState();
  const recent = config.project.recentProjects;

  if (recent.length === 0) return null;

  return (
    <div className="w-full text-left">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{heading}</p>
      <ul className="space-y-0.5">
        {recent.map((path) => (
          <li key={path}>
            <button
              type="button"
              title={path}
              onClick={() => onOpen(path)}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-ink-800"
            >
              <FolderIcon size={14} className="shrink-0 text-ink-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-ink-300">{baseName(path)}</span>
                <span className="block truncate font-mono text-[9px] text-ink-500">{path}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
