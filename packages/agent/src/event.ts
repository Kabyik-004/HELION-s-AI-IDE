import type { ToolCall, ToolResult } from "@forgeai/tools";

import type { AgentMessage } from "./message";
import type { AgentPlanStep } from "./task";

/** Why the agent stopped. */
export type AgentFinishStatus = "completed" | "failed" | "cancelled" | "max-iterations";

/**
 * The agent's conclusion after a tool ran — distinct from the raw `ToolResult`.
 *
 * Keeping "what happened" (`ToolResult`) separate from "what I make of it" (`Observation`)
 * is what allows the verification step in Module 6 to reason about success rather than
 * merely about exit codes.
 */
export interface Observation {
  readonly toolCallId: string;
  readonly summary: string;
  readonly succeeded: boolean;
}

/**
 * Everything the agent emits while running.
 *
 * `run()` returns an `AsyncIterable<AgentEvent>`, so a UI can render progress incrementally
 * and a test can assert the exact sequence — without either knowing how the loop works.
 * This union is the contract between the agent engine and every consumer.
 */
export type AgentEvent =
  | { readonly type: "started"; readonly taskId: string; readonly at: number }
  | { readonly type: "message"; readonly message: AgentMessage }
  | { readonly type: "plan"; readonly steps: readonly AgentPlanStep[] }
  | { readonly type: "tool-call"; readonly call: ToolCall }
  | { readonly type: "tool-result"; readonly callId: string; readonly result: ToolResult }
  | { readonly type: "observation"; readonly observation: Observation }
  | { readonly type: "error"; readonly message: string; readonly recoverable: boolean }
  | {
      readonly type: "finished";
      readonly status: AgentFinishStatus;
      readonly at: number;
      readonly summary?: string;
    };
