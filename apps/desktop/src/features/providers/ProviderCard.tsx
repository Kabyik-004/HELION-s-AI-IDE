import { useState } from "react";

import type { ProviderDescriptor } from "@forgeai/providers";
import type { ProviderInstanceConfig } from "@forgeai/storage";

import { Button } from "../../shared/ui/Button";
import { IconButton } from "../../shared/ui/IconButton";
import { PencilIcon, TrashIcon } from "../../shared/ui/Icons";
import type { ProviderConnectionState } from "./providers.slice";

export interface ProviderCardProps {
  readonly instance: ProviderInstanceConfig;
  readonly descriptor: ProviderDescriptor | undefined;
  readonly active: boolean;
  readonly credentialPresent: boolean;
  readonly connection: ProviderConnectionState | undefined;
  readonly onActivate: () => void;
  readonly onToggleEnabled: (enabled: boolean) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onTest: () => void;
  readonly onSaveKey: (secret: string) => Promise<boolean>;
  readonly onRemoveKey: () => void;
}

/**
 * One configured provider instance.
 *
 * The stored key is never shown — only whether one exists. The key input is local state and is
 * cleared as soon as it is saved, so a secret never settles into the store or a context.
 */
export function ProviderCard({
  instance,
  descriptor,
  active,
  credentialPresent,
  connection,
  onActivate,
  onToggleEnabled,
  onEdit,
  onDelete,
  onTest,
  onSaveKey,
  onRemoveKey,
}: ProviderCardProps) {
  const [editingKey, setEditingKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const endpoint = instance.baseUrl ?? descriptor?.defaultBaseUrl;
  const testing = connection?.state === "testing";

  async function saveKey(): Promise<void> {
    setBusy(true);
    const saved = await onSaveKey(keyDraft);
    setBusy(false);
    if (saved) {
      setKeyDraft("");
      setEditingKey(false);
    }
  }

  return (
    <div
      role="group"
      aria-label={instance.displayName}
      className={[
        "rounded border p-2.5",
        active ? "border-accent-600/70 bg-ink-850" : "border-ink-700 bg-ink-850",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-ink-100">{instance.displayName}</span>
            {active && (
              <span className="shrink-0 rounded bg-accent-600/20 px-1.5 py-0.5 text-[10px] font-medium text-accent-400">
                Active
              </span>
            )}
          </div>
          <p className="truncate font-mono text-[10px] text-ink-500">
            {descriptor?.name ?? instance.providerType}
            {endpoint !== undefined ? ` · ${endpoint}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <IconButton label={`Edit ${instance.displayName}`} size="sm" onClick={onEdit}>
            <PencilIcon size={13} />
          </IconButton>
          <IconButton label={`Delete ${instance.displayName}`} size="sm" onClick={onDelete}>
            <TrashIcon size={13} />
          </IconButton>
        </div>
      </div>

      <dl className="mt-2 space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-ink-500">Model</dt>
          <dd className="truncate font-mono text-[10px] text-ink-300">{instance.model ?? "not set"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-ink-500">API key</dt>
          <dd className="font-mono text-[10px] text-ink-300">
            {credentialPresent ? "•••••••• configured" : "not set"}
          </dd>
        </div>
      </dl>

      {editingKey && (
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="password"
            autoComplete="off"
            aria-label={`API key for ${instance.displayName}`}
            value={keyDraft}
            onChange={(event) => setKeyDraft(event.target.value)}
            placeholder={descriptor?.authentication.label ?? "API key"}
            className="w-full rounded border border-ink-650 bg-ink-950 px-2 py-1 text-ink-200 focus:border-accent-600 focus:outline-none"
          />
          <Button variant="primary" disabled={busy || keyDraft.trim().length === 0} onClick={() => void saveKey()}>
            Save
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setEditingKey(false);
              setKeyDraft("");
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {connection !== undefined && connection.state !== "idle" && (
        <p
          className={[
            "mt-2 leading-relaxed",
            connection.state === "ok" ? "text-success-500" : connection.state === "error" ? "text-danger-500" : "text-ink-400",
          ].join(" ")}
          title={connection.detail}
        >
          {connection.state === "testing" ? "Testing…" : connection.message}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {active ? (
          <Button variant="secondary" disabled>
            In use
          </Button>
        ) : (
          <Button variant="secondary" disabled={!instance.enabled} onClick={onActivate}>
            Use
          </Button>
        )}
        <Button variant="secondary" disabled={testing} onClick={onTest}>
          Test connection
        </Button>
        <Button variant="ghost" onClick={() => setEditingKey(true)}>
          {credentialPresent ? "Replace key" : "Set key"}
        </Button>
        {credentialPresent && (
          <Button variant="ghost" onClick={onRemoveKey}>
            Remove key
          </Button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-ink-400">
          <input
            type="checkbox"
            checked={instance.enabled}
            onChange={(event) => onToggleEnabled(event.target.checked)}
            className="h-3.5 w-3.5 accent-accent-500"
          />
          Enabled
        </label>
      </div>
    </div>
  );
}
