import { useAppState } from "../state/app-state";
import { PanelHeader } from "./PanelHeader";

/**
 * The project explorer.
 *
 * In Module 0 there is no file system port implementation, so there is nothing to list. Rather
 * than render mock files, the panel states what is missing. The tool list below it is real: it
 * reflects whatever is actually registered in the tool registry (currently nothing).
 */
export function ExplorerPanel() {
  const { services, config } = useAppState();
  const tools = services.toolRegistry.list();
  const recentProjects = config.project.recentProjects;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader>Explorer</PanelHeader>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        <button
          type="button"
          disabled
          title="Opening a folder requires the file system capability (Module 2)"
          className="mb-3 w-full cursor-not-allowed rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-500"
        >
          Open project…
        </button>

        <p className="mb-4 leading-relaxed text-zinc-500">
          No project is open. Folder browsing arrives with the file system tools in{" "}
          <span className="font-mono text-amber-500/80">Module 2</span>.
        </p>

        <SectionLabel>Tools registered</SectionLabel>
        {tools.length === 0 ? (
          <p className="mb-4 leading-relaxed text-zinc-500">
            No tools are registered yet. Tools can only run through the permission-guarded
            executor, and none are implemented in Module 0.
          </p>
        ) : (
          <ul className="mb-4 space-y-1">
            {tools.map((tool) => (
              <li key={tool.name} className="flex items-center justify-between gap-2">
                <span className="truncate font-mono text-zinc-300">{tool.name}</span>
                <span className="shrink-0 text-[10px] text-zinc-500">{tool.permissionLevel}</span>
              </li>
            ))}
          </ul>
        )}

        <SectionLabel>Recent projects</SectionLabel>
        {recentProjects.length === 0 ? (
          <p className="text-zinc-500">None yet.</p>
        ) : (
          <ul className="space-y-1">
            {recentProjects.map((project) => (
              <li key={project} className="truncate font-mono text-zinc-400" title={project}>
                {project}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { readonly children: string }) {
  return <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{children}</p>;
}
