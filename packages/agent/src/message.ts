import { newId } from "@forgeai/shared";

/**
 * Roles in the agent's own conversation history.
 *
 * These are richer than the provider-level `ChatRole` because the agent records things a
 * provider never sees: `observation` (what the agent concluded after a tool ran) and `tool`
 * (the raw result). An adapter flattens this history into provider messages when it calls a
 * model.
 */
export type AgentRole = "system" | "user" | "assistant" | "tool" | "observation";

export interface AgentMessage {
  readonly id: string;
  readonly role: AgentRole;
  readonly content: string;
  /** Unix epoch milliseconds. */
  readonly createdAt: number;
  /** Links a `tool` message to the `ToolCall` it answers. */
  readonly toolCallId?: string;
  /** Non-secret annotations (model id, token counts, ...). */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createAgentMessage(
  role: AgentRole,
  content: string,
  options: {
    readonly toolCallId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
    readonly now?: number;
    readonly id?: string;
  } = {},
): AgentMessage {
  return {
    id: options.id ?? newId("msg"),
    role,
    content,
    createdAt: options.now ?? Date.now(),
    toolCallId: options.toolCallId,
    metadata: options.metadata,
  };
}
