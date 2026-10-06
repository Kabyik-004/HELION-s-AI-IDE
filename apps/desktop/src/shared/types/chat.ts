/**
 * The AI panel's view model.
 *
 * This is deliberately a *view* type, not a provider type. Module 3 will translate the
 * provider-neutral `ChatChunk` stream from `@forgeai/providers` into these messages as text
 * arrives, so the panel never learns which provider or SDK produced the content.
 */

export type ChatRole = "user" | "assistant" | "system";

/**
 * Lifecycle of a message in the transcript.
 *
 * - `sent`     — a real message, either from the user or a completed assistant reply
 * - `pending`  — the assistant is still streaming (Module 3)
 * - `notice`   — a system/informational line, rendered differently from a message bubble
 * - `error`    — something went wrong; the message was not completed
 */
export type ChatMessageStatus = "sent" | "pending" | "notice" | "error";

export interface ChatViewMessage {
  readonly id: string;
  readonly role: ChatRole;
  readonly content: string;
  readonly status: ChatMessageStatus;
  readonly createdAt: number;
}
