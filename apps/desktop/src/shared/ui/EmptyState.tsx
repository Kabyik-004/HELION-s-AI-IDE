import type { ReactNode } from "react";

/**
 * Shown wherever a feature is intentionally not implemented yet.
 *
 * ForgeAI's principles forbid fake functionality, so instead of mock content we say plainly what
 * is missing and which module will add it.
 */
export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  readonly icon?: ReactNode;
  /** Which module will implement this. Shown as a subtle footer. */
  readonly plannedFor?: string;
}

export function EmptyState({ title, description, icon, plannedFor }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      {icon !== undefined && <div className="text-ink-500">{icon}</div>}
      <p className="text-xs font-medium text-ink-200">{title}</p>
      <p className="max-w-xs text-[11px] leading-relaxed text-ink-400">{description}</p>
      {plannedFor !== undefined && (
        <p className="mt-1 rounded border border-ink-700 bg-ink-850 px-2 py-0.5 font-mono text-[10px] text-accent-400/90">
          {plannedFor}
        </p>
      )}
    </div>
  );
}
