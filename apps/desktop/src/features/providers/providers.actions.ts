import type { FeatureDeps } from "../../app/featureContext";
import { ProviderValidationError, type ProviderService, type UpdateProviderPatch } from "./providerService";
import type { ProviderDraft } from "./providerValidation";

export interface ProviderActions {
  /** Adds an instance and stores its key. Returns false when validation failed. */
  addInstance(draft: ProviderDraft, credential: string): Promise<boolean>;
  updateInstance(id: string, patch: UpdateProviderPatch): Promise<boolean>;
  /** Confirms, then removes the instance and its credential together. */
  removeInstance(id: string): Promise<void>;
  setActive(id: string): Promise<void>;
  setModel(id: string, model: string | undefined): Promise<void>;
  setCredential(id: string, secret: string): Promise<boolean>;
  /** Confirms, then removes only the credential. */
  removeCredential(id: string): Promise<void>;
  testConnection(id: string): Promise<void>;
  /** Re-reads which instances have a credential, from the credential store. */
  refreshCredentials(): Promise<void>;
}

/**
 * The UI's whole vocabulary for providers.
 *
 * Components call these actions; they never touch `ProviderService`, `ConfigService` or the
 * credential store directly. Validation failures are reported as notifications and answers, not
 * thrown at the component.
 */
export function createProviderActions(deps: FeatureDeps, service: ProviderService): ProviderActions {
  const refreshCredentials = async (): Promise<void> => {
    const results = await Promise.all(
      service.listInstances().map(async (instance) => [instance.id, await service.hasCredential(instance.id)] as const),
    );
    for (const [instanceId, present] of results) {
      deps.dispatch({ type: "providerCredentialPresent", instanceId, present });
    }
  };

  const reportFailure = (cause: unknown): false => {
    if (cause instanceof ProviderValidationError) {
      deps.notify("warning", "Check the provider details", cause.issues.map((issue) => issue.message).join(" "));
    } else {
      deps.notify("error", "Provider operation failed", cause instanceof Error ? cause.message : String(cause));
    }
    return false;
  };

  return {
    refreshCredentials,

    async addInstance(draft, credential) {
      try {
        const instance = await service.addInstance(draft, credential);
        await refreshCredentials();
        deps.notify("success", "Provider added", instance.displayName);
        return true;
      } catch (cause) {
        return reportFailure(cause);
      }
    },

    async updateInstance(id, patch) {
      try {
        const instance = await service.updateInstance(id, patch);
        deps.notify("success", "Provider updated", instance.displayName);
        return true;
      } catch (cause) {
        return reportFailure(cause);
      }
    },

    async removeInstance(id) {
      const instance = service.getInstance(id);
      if (instance === undefined) return;
      const confirmed = await deps.dialogs.confirm({
        title: `Delete “${instance.displayName}”?`,
        message: "The provider configuration and its stored API key will both be removed.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await service.removeInstance(id);
        deps.dispatch({ type: "providerCredentialPresent", instanceId: id, present: false });
        deps.notify("success", "Provider removed", instance.displayName);
      } catch (cause) {
        reportFailure(cause);
      }
    },

    async setActive(id) {
      try {
        const instance = await service.setActive(id);
        deps.notify("success", "Provider activated", instance.displayName);
      } catch (cause) {
        reportFailure(cause);
      }
    },

    async setModel(id, model) {
      try {
        await service.setModel(id, model);
      } catch (cause) {
        reportFailure(cause);
      }
    },

    async setCredential(id, secret) {
      try {
        await service.setCredential(id, secret);
        await refreshCredentials();
        deps.notify("success", "API key saved", "The key is stored in the OS credential store.");
        return true;
      } catch (cause) {
        return reportFailure(cause);
      }
    },

    async removeCredential(id) {
      const instance = service.getInstance(id);
      const confirmed = await deps.dialogs.confirm({
        title: "Remove the API key?",
        message: `“${instance?.displayName ?? id}” will keep its configuration, but it will not be able to connect.`,
        confirmLabel: "Remove key",
        destructive: true,
      });
      if (!confirmed) return;
      try {
        await service.removeCredential(id);
        deps.dispatch({ type: "providerCredentialPresent", instanceId: id, present: false });
        deps.notify("success", "API key removed");
      } catch (cause) {
        reportFailure(cause);
      }
    },

    async testConnection(id) {
      deps.dispatch({ type: "providerConnectionState", instanceId: id, connection: { state: "testing" } });
      const result = await service.testConnection(id);
      deps.dispatch({
        type: "providerConnectionState",
        instanceId: id,
        connection: { state: result.ok ? "ok" : "error", message: result.message, detail: result.detail },
      });
    },
  };
}
