import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { collectProviderDescriptors, type ProviderDescriptor } from "@forgeai/providers";
import { DEFAULT_CONFIG, type ForgeAIConfig } from "@forgeai/storage";

import { createServices, type ForgeAIServices } from "../lib/services";
import { fetchAppInfo, type AppInfo } from "../lib/tauri";

/** Which panel the activity bar is showing on the left. */
export type SidebarView = "explorer" | "settings";

export interface AppStateValue {
  readonly services: ForgeAIServices;
  readonly config: ForgeAIConfig;
  /** Every provider ForgeAI knows about (implemented or planned). */
  readonly providers: readonly ProviderDescriptor[];
  /** `undefined` when not running inside Tauri (browser preview). */
  readonly appInfo: AppInfo | undefined;
  /** False until stored configuration has been read. */
  readonly ready: boolean;
  readonly sidebarView: SidebarView;
  setSidebarView(view: SidebarView): void;
  selectProvider(providerId: string | undefined): Promise<void>;
  selectModel(modelId: string | undefined): Promise<void>;
  updateAgentSettings(patch: { maxIterations?: number; autoApproveSafeTools?: boolean }): Promise<void>;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

/**
 * Provides the UI with services and configuration.
 *
 * Note what this component does *not* contain: any provider-specific logic, any shell call,
 * any file access. It wires configuration to the UI and nothing more, which is what keeps the
 * UI replaceable.
 */
export function AppStateProvider({ children }: { readonly children: ReactNode }) {
  // Created once per app instance; this is the composition root for the whole UI.
  const services = useMemo(createServices, []);
  const [config, setConfig] = useState<ForgeAIConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | undefined>(undefined);
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");

  const providers = useMemo(
    () => collectProviderDescriptors(services.providerRegistry),
    [services.providerRegistry],
  );

  useEffect(() => {
    let cancelled = false;
    const subscription = services.config.subscribe(setConfig);

    void (async () => {
      const loaded = await services.config.load();
      if (cancelled) return;
      setConfig(loaded);
      setReady(true);
      setAppInfo(await fetchAppInfo());
    })();

    return () => {
      cancelled = true;
      subscription.dispose();
    };
  }, [services]);

  const selectProvider = useCallback(
    async (providerId: string | undefined) => {
      // Changing provider invalidates the model, since models are provider-specific.
      await services.config.update({
        provider: { selectedProviderId: providerId, selectedModelId: undefined },
      });
    },
    [services],
  );

  const selectModel = useCallback(
    async (modelId: string | undefined) => {
      await services.config.update({ provider: { selectedModelId: modelId } });
    },
    [services],
  );

  const updateAgentSettings = useCallback(
    async (patch: { maxIterations?: number; autoApproveSafeTools?: boolean }) => {
      await services.config.update({ agent: patch });
    },
    [services],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      services,
      config,
      providers,
      appInfo,
      ready,
      sidebarView,
      setSidebarView,
      selectProvider,
      selectModel,
      updateAgentSettings,
    }),
    [services, config, providers, appInfo, ready, sidebarView, selectProvider, selectModel, updateAgentSettings],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

/** Reads the app state. Throws when used outside the provider (a programming error). */
export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (value === undefined) {
    throw new Error("useAppState() must be used inside <AppStateProvider>.");
  }
  return value;
}
