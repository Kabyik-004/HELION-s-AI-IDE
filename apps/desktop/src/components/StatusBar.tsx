import { useAppState } from "../state/app-state";

/** Bottom status bar: proves the Tauri IPC round-trip and mirrors configuration. */
export function StatusBar() {
  const { appInfo, ready, config } = useAppState();

  const runtime =
    appInfo === undefined ? "browser preview" : `${appInfo.name} ${appInfo.version}`;

  return (
    <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-zinc-800 bg-zinc-900 px-3 font-mono text-[10px] text-zinc-500">
      <span className="text-amber-500/80">{runtime}</span>
      <span>no project</span>
      <span className="ml-auto">
        {config.provider.selectedProviderId ?? "provider: none"} ·{" "}
        {config.provider.selectedModelId ?? "model: none"}
      </span>
      <span>permissions: {config.permissions.defaultPolicy}</span>
      <span>{ready ? "config: loaded" : "config: loading"}</span>
    </footer>
  );
}
