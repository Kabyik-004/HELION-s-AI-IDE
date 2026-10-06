import { useState, type FormEvent, type KeyboardEvent } from "react";

import { SendIcon, StopIcon } from "../../../shared/ui/Icons";

export interface ChatComposerProps {
  readonly onSend: (message: string) => void;
}

/**
 * The message composer.
 *
 * The textarea and Send button work: pressing Send appends the message to the local transcript.
 * The Stop button is rendered but disabled, because there is nothing streaming to stop yet — a
 * Stop control that silently did nothing would be worse than a visibly inert one.
 */
export function ChatComposer({ onSend }: ChatComposerProps) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (text.length === 0) return;
    onSend(text);
    setDraft("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline — the convention in every chat surface.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const lines = draft.length === 0 ? 2 : draft.split("\n").length;
  const rows = Math.min(7, Math.max(2, lines));

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-ink-700/70 p-2.5">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder="Ask ForgeAI about your project…"
        aria-label="Message ForgeAI"
        className="w-full resize-none rounded border border-ink-650 bg-ink-950 px-2.5 py-2 text-xs leading-relaxed text-ink-100 placeholder:text-ink-500 focus:border-accent-600 focus:outline-none"
      />

      <div className="mt-2 flex items-center gap-2">
        <button
          type="submit"
          disabled={draft.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded bg-accent-600 px-2.5 py-1.5 text-xs font-medium text-ink-950 transition-colors hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-ink-750 disabled:text-ink-500"
        >
          <SendIcon size={13} />
          Send
        </button>

        <button
          type="button"
          disabled
          title="Streaming is not connected yet — it arrives in Module 3"
          className="inline-flex items-center gap-1.5 rounded border border-ink-700 px-2.5 py-1.5 text-xs text-ink-500 disabled:cursor-not-allowed"
        >
          <StopIcon size={13} />
          Stop
        </button>

        <span className="ml-auto font-mono text-[10px] text-ink-500">Enter to send</span>
      </div>
    </form>
  );
}
