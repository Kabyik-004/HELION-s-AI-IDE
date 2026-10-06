import type { ChatViewMessage } from "../../../shared/types/chat";
import { InfoIcon, SparkleIcon } from "../../../shared/ui/Icons";

/** One entry in the transcript. Notices render as a quiet line; messages as an avatar + text. */
export function ChatMessageItem({ message }: { readonly message: ChatViewMessage }) {
  if (message.status === "notice") {
    return (
      <div className="flex items-start gap-2 px-3 py-1.5 text-[11px] leading-relaxed text-ink-500">
        <InfoIcon size={13} className="mt-px shrink-0 text-ink-500" />
        <p>{message.content}</p>
      </div>
    );
  }

  const isUser = message.role === "user";

  return (
    <div className={["flex gap-2 px-3 py-2", isUser ? "flex-row-reverse" : ""].join(" ")}>
      <div
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded",
          isUser ? "bg-ink-700 text-ink-200" : "bg-accent-500/15 text-accent-400",
        ].join(" ")}
        aria-hidden
      >
        {isUser ? <span className="text-[10px] font-semibold">You</span> : <SparkleIcon size={12} />}
      </div>

      <div
        className={[
          "min-w-0 max-w-[85%] rounded px-2.5 py-1.5 text-xs leading-relaxed",
          isUser ? "bg-ink-750 text-ink-100" : "text-ink-200",
          message.status === "error" ? "border border-danger-500/40 text-danger-500" : "",
        ].join(" ")}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.status === "pending" && (
          <p className="mt-1 text-[10px] text-ink-400">Streaming…</p>
        )}
      </div>
    </div>
  );
}
