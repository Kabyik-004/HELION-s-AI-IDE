import type { ReactNode } from "react";

import { PERMISSION_LEVELS, type PermissionLevel } from "@forgeai/security";

import { useAppState } from "../state/app-state";
import { PanelHeader } from "./PanelHeader";

const LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  SAFE: "Read-only, no side effects. May be auto-approved by policy.",
  MODERATE: "Changes files or repository state. Always asks the developer.",
  DANGEROUS: "Destructive or irreversible. Always asks, and is never remembered.",
};

/**
 * Settings for provider, model, agent and permissions.
 *
 * The provider and model lists come from the provider abstraction, never from hard-coded
 * checks — which is why this panel needs no changes when real adapters arrive in Module 1.
 */
export function SettingsPanel() {
  const { config, providers, selectProvider, selectModel, updateAgentSettings } = useAppState();

  const selectedProviderId = config.provider.selectedProviderId;
  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId);
  const needsApiKey = selectedProvider !== undefined && selectedProvider.authentication.kind === "api-key";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader>Settings</PanelHeader>

      <div className="min-h-0 flex-1 overflow-auto p-3 text-xs">
        <Field label="Provider">
          <select
            value={selectedProviderId ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              void selectProvider(next === "" ? undefined : next);
            }}
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-amber-500"
          >
            <option value="">Not selected</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Model">
          <select
            value={config.provider.selectedModelId ?? ""}
            disabled
            title="Models are listed once a provider adapter exists (Module 1)"
            onChange={(event) => void selectModel(event.target.value === "" ? undefined : event.target.value)}
            className="w-full cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-zinc-500"
          >
            <option value="">No models available yet</option>
          </select>
          <p className="mt-1 leading-relaxed text-zinc-500">
            Model lists require a provider adapter.{" "}
            <span className="font-mono text-amber-500/80">Module 1</span>
          </p>
        </Field>

        {selectedProvider !== undefined && (
          <div className="mb-4 rounded border border-zinc-800 bg-zinc-900/50 p-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              Provider details
            </p>
            <dl className="space-y-1">
              <Row label="Kind" value={selectedProvider.kind} />
              <Row label="Auth" value={selectedProvider.authentication.label} />
              {selectedProvider.defaultBaseUrl !== undefined && (
                <Row label="Endpoint" value={selectedProvider.defaultBaseUrl} />
              )}
            </dl>
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedProvider.capabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>
        )}

        <Field label="API key">
          <input
            type="password"
            disabled
            value=""
            readOnly
            placeholder={needsApiKey ? "Available in Module 1" : "Not required"}
            className="w-full cursor-not-allowed rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-zinc-500"
          />
          <p className="mt-1 leading-relaxed text-zinc-500">
            Keys will live in the operating system credential store — never in a config file.
            Until that exists, no key can be entered.{" "}
            <span className="font-mono text-amber-500/80">Module 1</span>
          </p>
        </Field>

        <Field label="Agent">
          <label className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-zinc-400">Max iterations</span>
            <input
              type="number"
              min={1}
              max={200}
              value={config.agent.maxIterations}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                if (Number.isFinite(parsed) && parsed > 0) {
                  void updateAgentSettings({ maxIterations: parsed });
                }
              }}
              className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-right text-zinc-200 outline-none focus:border-amber-500"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">Auto-approve SAFE tools</span>
            <input
              type="checkbox"
              checked={config.agent.autoApproveSafeTools}
              onChange={(event) => void updateAgentSettings({ autoApproveSafeTools: event.target.checked })}
              className="h-3.5 w-3.5 accent-amber-500"
            />
          </label>
          <p className="mt-1 leading-relaxed text-zinc-500">
            These are stored through the configuration service. The agent loop itself is{" "}
            <span className="font-mono text-amber-500/80">Module 6</span>.
          </p>
        </Field>

        <Field label="Permission levels">
          <ul className="space-y-1.5">
            {PERMISSION_LEVELS.map((level) => (
              <li key={level}>
                <span className="font-mono text-[10px] text-amber-500/80">{level}</span>
                <p className="leading-relaxed text-zinc-500">{LEVEL_DESCRIPTIONS[level]}</p>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 leading-relaxed text-zinc-500">
            Action required approvals are refused by default until the approval dialog exists.{" "}
            <span className="font-mono text-amber-500/80">Module 3</span>
          </p>
        </Field>

        <Field label="Configuration (live)">
          <pre className="max-h-52 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 font-mono text-[10px] leading-relaxed text-zinc-400">
            {JSON.stringify(config, null, 2)}
          </pre>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      {children}
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="truncate font-mono text-[10px] text-zinc-400" title={value}>
        {value}
      </dd>
    </div>
  );
}
