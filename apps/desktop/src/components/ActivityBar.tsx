import { useAppState, type SidebarView } from "../state/app-state";

interface ActivityItem {
  readonly id: SidebarView;
  readonly label: string;
  /** Emoji keeps Module 0 free of an icon dependency. A real icon set can replace these. */
  readonly glyph: string;
}

const ITEMS: readonly ActivityItem[] = [
  { id: "explorer", label: "Explorer", glyph: "🗂" },
  { id: "settings", label: "Settings", glyph: "⚙" },
];

/** The slim vertical bar on the far left that switches the side panel. */
export function ActivityBar() {
  const { sidebarView, setSidebarView } = useAppState();

  return (
    <nav
      aria-label="Primary"
      className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-zinc-800 bg-zinc-900 py-2"
    >
      {ITEMS.map((item) => {
        const active = item.id === sidebarView;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            onClick={() => setSidebarView(item.id)}
            className={[
              "relative flex h-9 w-9 items-center justify-center rounded text-base transition-colors",
              active
                ? "bg-zinc-800 text-amber-400"
                : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300",
            ].join(" ")}
          >
            {active && (
              <span className="absolute left-0 top-1.5 h-6 w-0.5 rounded-r bg-amber-400" aria-hidden />
            )}
            <span aria-hidden>{item.glyph}</span>
          </button>
        );
      })}
    </nav>
  );
}
