import type { IdeAction } from "../../app/ideActions";

/** The outcome of the last connection test for an instance. */
export interface ProviderConnectionState {
  readonly state: "idle" | "testing" | "ok" | "error";
  readonly message?: string;
  /** Developer-facing context, shown behind a Details affordance. */
  readonly detail?: string;
}

/**
 * Provider view state.
 *
 * This holds only what the UI needs to *display*: whether a key is stored and the last test
 * result, keyed by instance id. It deliberately holds **no credential** and no configuration —
 * configuration lives in `ConfigService`, secrets in the credential store.
 */
export interface ProvidersSliceState {
  readonly credentialPresent: Readonly<Record<string, boolean>>;
  readonly connection: Readonly<Record<string, ProviderConnectionState>>;
}

export function initialProvidersSlice(): ProvidersSliceState {
  return { credentialPresent: {}, connection: {} };
}

export type ProvidersAction =
  | { readonly type: "providerCredentialPresent"; readonly instanceId: string; readonly present: boolean }
  | {
      readonly type: "providerConnectionState";
      readonly instanceId: string;
      readonly connection: ProviderConnectionState;
    };

export function reduceProviders(state: ProvidersSliceState, action: IdeAction): ProvidersSliceState {
  switch (action.type) {
    case "providerCredentialPresent":
      return {
        ...state,
        credentialPresent: { ...state.credentialPresent, [action.instanceId]: action.present },
      };
    case "providerConnectionState":
      return {
        ...state,
        connection: { ...state.connection, [action.instanceId]: action.connection },
      };
    default:
      return state;
  }
}
