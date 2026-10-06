import type { ReactNode } from "react";

/** Compact uppercase header used at the top of side panels and the bottom panel. */
export function PanelHeader({ children, actions }: { readonly children: ReactNode; readonly actions?: ReactNode }) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-ink-700/70 px-3">
      <h2 className="truncate text-[11px] font-semibold uppercase tracking-wider text-ink-300">{children}</h2>
      {actions !== undefined && <div className="flex items-center gap-0.5">{actions}</div>}
    </header>
  );
}
