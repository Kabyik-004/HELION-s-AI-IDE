import { useEffect, useRef } from "react";

import { useAppState } from "../../../app/AppStateProvider";
import { useIde } from "../../../app/IdeProvider";
import { IconButton } from "../../../shared/ui/IconButton";
import { PanelHeader } from "../../../shared/ui/PanelHeader";
import { SettingsIcon } from "../../../shared/ui/Icons";
import { ChatComposer } from "./ChatComposer";
import { ChatMessageItem } from "./ChatMessageItem";

/**
 * The AI assistant panel.
 *
 * This is the complete interaction surface — transcript, composer, send, and the model/provider
 * indicator — deliberately left unconnected. The provider module will translate its neutral stream
 * into `ChatViewMessage` entries, at which point `status: "pending"` and the Stop button become live.
 * No layout or component change will be required then.
 */
export function AIChatPanel() {
  const { state, api } = useIde();
  const { config } = useAppState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages } = state.assistant;

  // Keep the newest message in view as the transcript grows.
  useEffect(() => {
    const container = scrollRef.current;
    if (container !== null) container.scrollTop = container.scrollHeight;
  }, [messages.length]);

  const active = config.provider.instances.find(
    (instance) => instance.id === config.provider.selectedProviderId,
  );
  const keyPresent = active !== undefined && state.providers.credentialPresent[active.id] === true;
  const connected = active !== undefined && active.enabled && keyPresent;

  return (
    <section aria-label="AI assistant" className="flex h-full min-h-0 flex-col border-l border-ink-700/70 bg-ink-900">
      <PanelHeader
        actions={
          <IconButton label="AI settings" size="sm" onClick={() => api.panels.activateActivity("settings")}>
            <SettingsIcon size={14} />
          </IconButton>
        }
      >
        AI assistant
      </PanelHeader>

      <div
        className="flex shrink-0 items-center gap-2 border-b border-ink-700/70 px-3 py-1.5"
        title={connected ? "Connected" : "No provider is connected yet"}
      >
        <span
          className={["h-1.5 w-1.5 shrink-0 rounded-full", connected ? "bg-success-500" : "bg-ink-500"].join(" ")}
          aria-hidden
        />
        <span className="truncate font-mono text-[10px] text-ink-400">
          {active?.displayName ?? "no provider"} · {active?.model ?? "no model"}
        </span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-1">
        {messages.map((message) => (
          <ChatMessageItem key={message.id} message={message} />
        ))}
      </div>

      <ChatComposer onSend={api.assistant.sendMessage} />
    </section>
  );
}
