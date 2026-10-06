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

import { createServices, type ForgeAIServices } from "./composition";
import { backend, type AppInfoDto } from "../infrastructure/ipc/backend";

/** How many folders ForgeAI remembers. */
const MAX_RECENT_PROJECTS = 8;

/**
 * Application services and user configuration.
 *
 * Panel visibility, open editors and layout sizes are deliberately *not* here — they are view
 * state and belong to `IdeStateProvider`. Keeping configuration and view state apart means a
 * settings change does not re-render the whole shell, and closing a panel never risks a config
 * write.
 */
export interface AppStateValue {
  readonly services: ForgeAIServices;
  readonly config: ForgeAIConfig;
  /** Every provider ForgeAI knows about (implemented or planned). */
  readonly providers: readonly ProviderDescriptor[];
  /** `undefined` when not running inside Tauri (browser preview). */
  readonly appInfo: AppInfoDto | undefined;
  /** False until stored configuration has been read. */
  readonly ready: boolean;
  selectProvider(providerId: string | undefined): Promise<void>;
  selectModel(modelId: string | undefined): Promise<void>;
  updateAgentSettings(patch: { maxIterations?: number; autoApproveSafeTools?: boolean }): Promise<void>;
  /** Records a folder in the recent list, newest first. Persisted when the desktop backend is available. */
  rememberProject(path: string): Promise<void>;
}

const AppStateContext = createContext<AppStateValue | undefined>(undefined);

/**
 * Provides the UI with services and configuration.
 *
 * Note what this component does *not* contain: any provider-specific logic, any shell call, any
 * file access. It wires configuration to the UI and nothing more, which is what keeps the UI
 * replaceable.
 */
export function AppStateProvider({ children }: { readonly children: ReactNode }) {
  // Created once per app instance; this is the composition root for the whole UI.
  const services = useMemo(createServices, []);
  const [config, setConfig] = useState<ForgeAIConfig>(DEFAULT_CONFIG);
  const [ready, setReady] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfoDto | undefined>(undefined);

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
      if (!services.native) return;
      try {
        setAppInfo(await backend.appInfo());
      } catch {
        // The status bar simply shows the browser preview label instead.
      }
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

  /**
   * Records a folder in the recent list.
   *
   * A plain newest-first list is all Module 2 needs; there is no project database. The list is
   * persisted through `ConfigService`, which writes to the application config file when the
   * desktop backend is available.
   */
  const rememberProject = useCallback(
    async (path: string) => {
      const existing = services.config.get().project.recentProjects;
      const next = [path, ...existing.filter((entry) => entry !== path)].slice(0, MAX_RECENT_PROJECTS);
      await services.config.update({ project: { recentProjects: next } });
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
      selectProvider,
      selectModel,
      updateAgentSettings,
      rememberProject,
    }),
    [services, config, providers, appInfo, ready, selectProvider, selectModel, updateAgentSettings, rememberProject],
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
