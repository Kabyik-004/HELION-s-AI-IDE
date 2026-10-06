import type { PermissionLevel } from "@forgeai/security";
import type { CommandRunnerPort, FileSystemPort, Logger } from "@forgeai/shared";

import type { JsonSchema } from "./json-schema";

/**
 * Everything a tool is allowed to touch.
 *
 * Tools never import a platform API directly; they receive their capabilities through this
 * context. That is what makes a tool testable with fake ports and replaceable when the real
 * implementation moves to Rust.
 */
export interface ToolExecutionContext {
  /** Absolute path of the opened project. Implementations must confine access to it. */
  readonly projectRoot: string;
  /** Groups calls belonging to one agent conversation (used for permission grants). */
  readonly sessionId?: string;
  /** Cancels long-running tools. */
  readonly signal?: AbortSignal;
  readonly logger: Logger;
  readonly fs: FileSystemPort;
  readonly commands: CommandRunnerPort;
  /** Injectable clock, so tests and replays are deterministic. */
  readonly now: () => number;
}

export type ToolResult<Output = unknown> =
  | { readonly ok: true; readonly output: Output; readonly durationMs: number }
  | { readonly ok: false; readonly error: string; readonly durationMs: number };

/** A request to run a specific tool with specific input. */
export interface ToolCall<Input = unknown> {
  readonly id: string;
  readonly toolName: string;
  readonly input: Input;
  /** Id of the agent message or task that requested the call, for traceability. */
  readonly requestedBy?: string;
  readonly createdAt: number;
}

/**
 * The contract every ForgeAI tool implements.
 *
 * `permissionLevel` is mandatory: a tool without a declared risk level cannot be registered,
 * which prevents new tools from silently bypassing the security boundary.
 */
export interface ToolDefinition<Input = unknown, Output = unknown> {
  /** Stable machine name, e.g. `read_file`. Used by models to call the tool. */
  readonly name: string;
  /** Shown to the model so it knows when to use the tool. */
  readonly description: string;
  /** Shown to the model so it can build valid input. */
  readonly inputSchema: JsonSchema;
  readonly permissionLevel: PermissionLevel;
  /**
   * Human-readable description of one concrete invocation, shown in the approval prompt.
   * Falls back to a generic summary when omitted.
   */
  readonly summarize?: (input: Input) => string;
  readonly execute: (input: Input, context: ToolExecutionContext) => Promise<ToolResult<Output>>;
}

/**
 * A `ToolDefinition` with its generic parameters erased.
 *
 * The registry stores tools of many different input/output shapes in one collection, so the
 * boundary has to be untyped. Keeping this alias in one place makes the escape hatch obvious.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- see comment above
export type AnyToolDefinition = ToolDefinition<any, any>;

/** A schema-only view of a tool, suitable for handing to an AI model or the UI. */
export interface ToolSummary {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly permissionLevel: PermissionLevel;
}
