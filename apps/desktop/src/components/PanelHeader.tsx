import type { ReactNode } from "react";

/** Uppercase section header used at the top of side panels. */
export function PanelHeader({ children, actions }: { readonly children: ReactNode; readonly actions?: ReactNode }) {
  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{children}</h2>
      {actions}
    </header>
  );
}
