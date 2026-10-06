import { useAppState } from "../state/app-state";

/**
 * The chat surface.
 *
 * There is no provider adapter yet, so there is nothing to talk to. The panel shows the
 * selected provider/model from configuration and explains what is missing, rather than
 * offering a composer that silently does nothing.
 */
export function ChatPanel() {
  const { config, providers } = useAppState();

  const selectedProvider = providers.find(
    (provider) => provider.id === config.provider.selectedProviderId,
  );

  return (
    <section className="flex w-80 shrink-0 flex-col border-l border-zinc-800 bg-zinc-900/40">
      <header className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          ForgeAI Chat
        </h2>
        <span className="rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-amber-500/80">
          Module 1
        </span>
      </header>

      <div className="border-b border-zinc-800 px-3 py-2">
        <p className="font-mono text-[10px] text-zinc-500">
          {selectedProvider?.name ?? "no provider"} / {config.provider.selectedModelId ?? "no model"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-zinc-400">Chat is not connected</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          Connect a provider with your own API key, then this panel will stream replies from the
          selected model. Provider adapters and secure credential storage arrive in{" "}
          <span className="font-mono text-amber-500/80">Module 1</span>.
        </p>
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-3">
        <textarea
          disabled
          rows={2}
          placeholder="Ask ForgeAI about your project…"
          title="No provider is connected yet (Module 1)"
          className="w-full cursor-not-allowed resize-none rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs text-zinc-500 placeholder:text-zinc-600"
        />
        <button
          type="button"
          disabled
          className="mt-2 w-full cursor-not-allowed rounded bg-zinc-800 px-2 py-1.5 text-xs font-medium text-zinc-500"
        >
          Send
        </button>
      </div>
    </section>
  );
}
