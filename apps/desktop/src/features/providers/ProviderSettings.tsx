import { useState } from "react";

import { useAppState } from "../../app/AppStateProvider";
import { useIde } from "../../app/IdeProvider";
import { Button } from "../../shared/ui/Button";
import { ProviderCard } from "./ProviderCard";
import { ProviderForm } from "./ProviderForm";

type Mode = { readonly kind: "idle" } | { readonly kind: "add" } | { readonly kind: "edit"; readonly id: string };

/**
 * Provider management: add, edit, remove, enable, select, store a key and test connectivity.
 *
 * Every mutation goes through `api.providers` — this component never touches configuration or the
 * credential store itself, and it never holds a key beyond the moment it is entered.
 */
export function ProviderSettings() {
  const { config, providers } = useAppState();
  const { state, api } = useIde();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });

  const instances = config.provider.instances;
  const activeId = config.provider.selectedProviderId;
  const editing = mode.kind === "edit" ? instances.find((instance) => instance.id === mode.id) : undefined;
  const descriptorFor = (providerType: string) => providers.find((descriptor) => descriptor.id === providerType);
  const existingIds = instances.map((instance) => instance.id);

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Providers</p>
        <Button variant="secondary" onClick={() => setMode({ kind: "add" })} disabled={mode.kind === "add"}>
          Add provider
        </Button>
      </div>

      {mode.kind === "add" && (
        <ProviderForm
          descriptors={providers}
          existingIds={existingIds}
          onAdd={api.providers.addInstance}
          onUpdate={api.providers.updateInstance}
          onCancel={() => setMode({ kind: "idle" })}
        />
      )}

      {instances.length === 0 && mode.kind !== "add" && (
        <p className="leading-relaxed text-ink-500">
          No providers configured. Add one to store an API key securely and test the connection.
        </p>
      )}

      <div className="space-y-2">
        {instances.map((instance) => (
          <ProviderCard
            key={instance.id}
            instance={instance}
            descriptor={descriptorFor(instance.providerType)}
            active={instance.id === activeId}
            credentialPresent={state.providers.credentialPresent[instance.id] === true}
            connection={state.providers.connection[instance.id]}
            onActivate={() => void api.providers.setActive(instance.id)}
            onToggleEnabled={(enabled) => void api.providers.updateInstance(instance.id, { enabled })}
            onEdit={() => setMode({ kind: "edit", id: instance.id })}
            onDelete={() => void api.providers.removeInstance(instance.id)}
            onTest={() => void api.providers.testConnection(instance.id)}
            onSaveKey={(secret) => api.providers.setCredential(instance.id, secret)}
            onRemoveKey={() => void api.providers.removeCredential(instance.id)}
          />
        ))}
      </div>

      {editing !== undefined && (
        <div className="mt-2">
          <ProviderForm
            descriptors={providers}
            existingIds={existingIds}
            editing={editing}
            onAdd={api.providers.addInstance}
            onUpdate={api.providers.updateInstance}
            onCancel={() => setMode({ kind: "idle" })}
          />
        </div>
      )}
    </section>
  );
}
