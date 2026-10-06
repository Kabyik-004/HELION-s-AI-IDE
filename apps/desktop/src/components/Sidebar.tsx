import { useAppState } from "../state/app-state";
import { ExplorerPanel } from "./ExplorerPanel";
import { SettingsPanel } from "./SettingsPanel";

/** Left side panel; switches between explorer and settings based on the activity bar. */
export function Sidebar() {
  const { sidebarView, config } = useAppState();

  // Width comes from configuration, which shows the config service driving the UI for real.
  return (
    <aside
      style={{ width: config.ui.sidebarWidth }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-900/60"
    >
      {sidebarView === "explorer" ? <ExplorerPanel /> : <SettingsPanel />}
    </aside>
  );
}
