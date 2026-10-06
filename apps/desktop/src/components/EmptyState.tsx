/**
 * Placeholder shown wherever a feature is intentionally not implemented yet.
 *
 * ForgeAI's principles forbid fake functionality, so instead of a mock list of files we say
 * plainly what is missing and which module will add it.
 */
export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  /** Which module will implement this. Shown as a subtle footer. */
  readonly plannedFor?: string;
}

export function EmptyState({ title, description, plannedFor }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      <p className="max-w-xs text-xs leading-relaxed text-zinc-500">{description}</p>
      {plannedFor !== undefined && (
        <p className="mt-1 rounded border border-zinc-800 bg-zinc-900 px-2 py-0.5 font-mono text-[10px] text-amber-500/80">
          {plannedFor}
        </p>
      )}
    </div>
  );
}
