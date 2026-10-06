import { useIde } from "../../../app/IdeProvider";
import { EmptyState } from "../../../shared/ui/EmptyState";
import { PanelHeader } from "../../../shared/ui/PanelHeader";
import { GitBranchIcon, SearchIcon } from "../../../shared/ui/Icons";
import { ExplorerPanel } from "../../explorer/explorer-panel/ExplorerPanel";
import { SettingsPanel } from "../../settings/SettingsPanel";

/**
 * The left side panel: whichever activity the activity bar has selected.
 *
 * A pure switch. Each view is its own feature module; this only decides which one is on screen.
 */
export function SidePanel() {
  const { state } = useIde();

  switch (state.layout.activity) {
    case "explorer":
      return <ExplorerPanel />;
    case "settings":
      return <SettingsPanel />;
    case "search":
      return (
        <div className="flex h-full min-h-0 flex-col">
          <PanelHeader>Search</PanelHeader>
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={<SearchIcon size={20} />}
              title="Search is not available yet"
              description="Project-wide search reads every file in the folder, so it is built together with its own interface."
              plannedFor="a later module"
            />
          </div>
        </div>
      );
    case "source-control":
      return (
        <div className="flex h-full min-h-0 flex-col">
          <PanelHeader>Source control</PanelHeader>
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={<GitBranchIcon size={20} />}
              title="No repository detected"
              description="Git status, diffs and commits are modelled in the git package and will be wired to the UI in a later module."
              plannedFor="later module"
            />
          </div>
        </div>
      );
    default:
      return null;
  }
}
