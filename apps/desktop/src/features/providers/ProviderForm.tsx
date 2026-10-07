import { useState, type ReactNode } from "react";

import type { ProviderDescriptor } from "@forgeai/providers";
import type { ProviderInstanceConfig } from "@forgeai/storage";

import { Button } from "../../shared/ui/Button";
import { validateProviderDraft, type ProviderDraft, type ValidationIssue } from "./providerValidation";

export interface ProviderFormProps {
  readonly descriptors: readonly ProviderDescriptor[];
  readonly existingIds: readonly string[];
  /** Present when editing; absent when adding. */
  readonly editing?: ProviderInstanceConfig;
  readonly onAdd: (draft: ProviderDraft, credential: string) => Promise<boolean>;
  readonly onUpdate: (
    id: string,
    patch: { displayName: string; baseUrl: string; model: string; enabled: boolean },
  ) => Promise<boolean>;
  readonly onCancel: () => void;
}

const INPUT =
  "w-full rounded border border-ink-650 bg-ink-950 px-2 py-1.5 text-ink-200 focus:border-accent-600 focus:outline-none";

/**
 * The add/edit form for one provider instance.
 *
 * It validates with the same pure function the service uses, so the message a developer sees inline
 * is the message the service would raise. The API key is held only in this component's local state
 * for the duration of the edit — it is never placed in the store, configuration or any context.
 */
export function ProviderForm({ descriptors, existingIds, editing, onAdd, onUpdate, onCancel }: ProviderFormProps) {
  const [providerType, setProviderType] = useState(editing?.providerType ?? descriptors[0]?.id ?? "");
  const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl ?? "");
  const [model, setModel] = useState(editing?.model ?? "");
  const [enabled, setEnabled] = useState(editing?.enabled ?? true);
  const [apiKey, setApiKey] = useState("");
  const [issues, setIssues] = useState<readonly ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);

  const descriptor = descriptors.find((candidate) => candidate.id === providerType);
  const needsKey = descriptor !== undefined && descriptor.authentication.kind === "api-key";

  const issueFor = (field: ValidationIssue["field"]): string | undefined =>
    issues.find((issue) => issue.field === field)?.message;

  async function submit(): Promise<void> {
    const draft: ProviderDraft = { providerType, displayName, baseUrl, model, enabled };
    const result = validateProviderDraft(draft, { descriptors, existingIds, editingId: editing?.id });

    const local: ValidationIssue[] = result.ok ? [] : [...result.issues];
    if (editing === undefined && needsKey && apiKey.trim().length === 0) {
      local.push({ field: "credential", message: "Enter an API key." });
    }
    if (local.length > 0) {
      setIssues(local);
      return;
    }

    setBusy(true);
    const saved =
      editing === undefined
        ? await onAdd(draft, apiKey)
        : await onUpdate(editing.id, { displayName, baseUrl, model, enabled });
    setBusy(false);
    if (saved) {
      setApiKey("");
      setIssues([]);
      onCancel();
    }
  }

  return (
    <form
      className="mb-2 rounded border border-ink-700 bg-ink-850 p-2.5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-500">
        {editing === undefined ? "Add provider" : `Edit ${editing.displayName}`}
      </p>

      <Field id="provider-type" label="Provider" error={issueFor("providerType")}>
        <select
          id="provider-type"
          value={providerType}
          disabled={editing !== undefined}
          onChange={(event) => setProviderType(event.target.value)}
          className={editing === undefined ? INPUT : `${INPUT} cursor-not-allowed opacity-60`}
        >
          {descriptors.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="provider-name" label="Display name" error={issueFor("displayName")}>
        <input
          id="provider-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={descriptor?.name ?? "My provider"}
          className={INPUT}
        />
      </Field>

      <Field id="provider-base-url" label="Base URL" error={issueFor("baseUrl")}>
        <input
          id="provider-base-url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder={descriptor?.defaultBaseUrl ?? "https://…"}
          className={INPUT}
        />
        <p className="mt-1 leading-relaxed text-ink-500">Optional. Leave blank to use the provider default.</p>
      </Field>

      <Field id="provider-model" label="Model" error={issueFor("model")}>
        <input
          id="provider-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder="e.g. gpt-4o-mini"
          className={INPUT}
        />
      </Field>

      {editing === undefined && (
        <Field id="provider-api-key" label="API key" error={issueFor("credential")}>
          <input
            id="provider-api-key"
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={needsKey ? descriptor?.authentication.label ?? "API key" : "Not required"}
            disabled={!needsKey}
            className={needsKey ? INPUT : `${INPUT} cursor-not-allowed opacity-60`}
          />
          <p className="mt-1 leading-relaxed text-ink-500">
            Stored in the OS credential store, never in a configuration file.
            {descriptor?.authentication.documentationUrl !== undefined && (
              <>
                {" "}
                <a
                  className="text-accent-400/90 hover:underline"
                  href={descriptor.authentication.documentationUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Where do I find this?
                </a>
              </>
            )}
          </p>
        </Field>
      )}

      <label className="mb-3 flex items-center justify-between gap-2">
        <span className="text-ink-300">Enabled</span>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="h-3.5 w-3.5 accent-accent-500"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {editing === undefined ? "Save provider" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="mb-3">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-ink-500"
      >
        {label}
      </label>
      {children}
      {error !== undefined && <p className="mt-1 leading-relaxed text-danger-500">{error}</p>}
    </div>
  );
}
