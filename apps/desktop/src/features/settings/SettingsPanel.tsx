import { PERMISSION_LEVELS, type PermissionLevel } from "@forgeai/security";
import type { ReactNode } from "react";

import { useAppState } from "../../app/AppStateProvider";
import { PanelHeader } from "../../shared/ui/PanelHeader";
import { ProviderSettings } from "../providers/ProviderSettings";

const LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  SAFE: "Read-only, no side effects. May be auto-approved by policy.",
  MODERATE: "Changes files or repository state. Always asks the developer.",
  DANGEROUS: "Destructive or irreversible. Always asks, and is never remembered.",
};

/**
 * Settings for providers, the agent and permissions.
 *
 * Provider management lives in its own feature module (`features/providers`) so this panel stays a
 * compact layout of sections rather than one large component.
 */
export function SettingsPanel() {
  const { config, updateAgentSettings } = useAppState();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader>Settings</PanelHeader>

      <div className="min-h-0 flex-1 overflow-auto px-3 py-3 text-xs">
        <ProviderSettings />

        <Field label="Agent">
          <label className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-ink-300">Max iterations</span>
            <input
              type="number"
              min={1}
              max={200}
              value={config.agent.maxIterations}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(parsed) && parsed > 0) void updateAgentSettings({ maxIterations: parsed });
              }}
              className="w-20 rounded border border-ink-650 bg-ink-950 px-2 py-1 text-right text-ink-200 focus:border-accent-600 focus:outline-none"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-ink-300">Auto-approve SAFE tools</span>
            <input
              type="checkbox"
              checked={config.agent.autoApproveSafeTools}
              onChange={(event) => void updateAgentSettings({ autoApproveSafeTools: event.target.checked })}
              className="h-3.5 w-3.5 accent-accent-500"
            />
          </label>
        </Field>

        <Field label="Permission levels">
          <ul className="space-y-1.5">
            {PERMISSION_LEVELS.map((level) => (
              <li key={level}>
                <span className="font-mono text-[10px] text-accent-400/90">{level}</span>
                <p className="leading-relaxed text-ink-500">{LEVEL_DESCRIPTIONS[level]}</p>
              </li>
            ))}
          </ul>
        </Field>

        <Field label="Configuration (live)">
          <pre className="max-h-40 overflow-auto rounded border border-ink-700 bg-ink-950 p-2 font-mono text-[10px] leading-relaxed text-ink-400">
            {JSON.stringify(config, null, 2)}
          </pre>
          <p className="mt-1 leading-relaxed text-ink-500">
            Preferences only. Older files without a provider list load with an empty one.
          </p>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      {children}
    </div>
  );
}
