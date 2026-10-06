import { useIde } from "../../../app/IdeProvider";
import { IconButton } from "../../../shared/ui/IconButton";
import { FolderIcon, GitBranchIcon, SearchIcon, SettingsIcon } from "../../../shared/ui/Icons";
import type { ActivityView } from "../layout/layout.types";
import type { ReactNode } from "react";

interface ActivityItem {
  readonly id: ActivityView;
  readonly label: string;
  readonly icon: ReactNode;
  /** Icon-only entries for features that do not exist yet. Kept visible, clearly disabled. */
  readonly disabled?: boolean;
  readonly reason?: string;
}

const PRIMARY_ITEMS: readonly ActivityItem[] = [
  { id: "explorer", label: "Explorer (Ctrl+Shift+O)", icon: <FolderIcon size={18} /> },
  {
    id: "search",
    label: "Search",
    icon: <SearchIcon size={18} />,
    disabled: true,
    reason: "Project-wide search needs its own interface, which arrives in a later module",
  },
  {
    id: "source-control",
    label: "Source control",
    icon: <GitBranchIcon size={18} />,
    disabled: true,
    reason: "Git integration arrives in a later module",
  },
];

/** The slim vertical rail that selects the side panel, like every serious editor has. */
export function ActivityBar() {
  const { state, api } = useIde();
  const { activity, sidebarVisible } = state.layout;

  const renderItem = (item: ActivityItem) => (
    <IconButton
      key={item.id}
      label={item.label}
      title={item.disabled === true ? item.reason : item.label}
      disabled={item.disabled ?? false}
      active={!item.disabled && activity === item.id && sidebarVisible}
      onClick={() => api.panels.activateActivity(item.id)}
      className="h-9 w-9"
    >
      {item.icon}
    </IconButton>
  );

  return (
    <nav
      aria-label="Activity"
      className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-ink-700/70 bg-ink-900 py-1.5"
    >
      {PRIMARY_ITEMS.map(renderItem)}
      <div className="mt-auto">
        {renderItem({ id: "settings", label: "Settings", icon: <SettingsIcon size={18} /> })}
      </div>
    </nav>
  );
}
