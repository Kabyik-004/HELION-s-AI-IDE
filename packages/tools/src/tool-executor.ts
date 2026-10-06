import {
  describePermission,
  type PermissionDecision,
  type PermissionInterceptor,
} from "@forgeai/security";
import { createLogger, newId, type Logger } from "@forgeai/shared";

import type { ToolRegistry } from "./tool-registry";
import type { ToolCall, ToolExecutionContext, ToolResult } from "./tool";

/**
 * What happened when a tool call was submitted.
 *
 * A refusal is a normal outcome, not an exception: "the AI tried to do something the
 * developer did not allow" is a first-class, expected event that the agent and the UI must
 * be able to render.
 */
export type ToolExecutionOutcome<Output = unknown> =
  | { readonly status: "completed"; readonly result: ToolResult<Output> }
  | { readonly status: "denied"; readonly decision: PermissionDecision }
  | { readonly status: "unknown-tool"; readonly toolName: string };

export interface ToolExecutor {
  execute<Output = unknown>(call: ToolCall, context: ToolExecutionContext): Promise<ToolExecutionOutcome<Output>>;
}

export interface GuardedToolExecutorOptions {
  readonly registry: ToolRegistry;
  readonly permissions: PermissionInterceptor;
  readonly logger?: Logger;
}

/**
 * The single execution path for every tool in ForgeAI.
 *
 * The ordering here is the security boundary, and it must not be reordered:
 *
 *   1. resolve the tool,
 *   2. ask the permission system (BEFORE anything happens),
 *   3. refuse unless the answer is `allow`,
 *   4. only then execute.
 *
 * Because tools are only reachable through this class, a tool cannot forget to check
 * permissions — there is nowhere else to call it from.
 */
export class GuardedToolExecutor implements ToolExecutor {
  readonly #registry: ToolRegistry;
  readonly #permissions: PermissionInterceptor;
  readonly #logger: Logger;

  constructor(options: GuardedToolExecutorOptions) {
    this.#registry = options.registry;
    this.#permissions = options.permissions;
    this.#logger = options.logger ?? createLogger("tools");
  }

  async execute<Output = unknown>(
    call: ToolCall,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionOutcome<Output>> {
    const tool = this.#registry.get(call.toolName);

    if (tool === undefined) {
      this.#logger.warn("tool call for an unknown tool", { tool: call.toolName });
      return { status: "unknown-tool", toolName: call.toolName };
    }

    const summary = tool.summarize?.(call.input) ?? `${tool.name} (${tool.permissionLevel})`;
    const request = describePermission({
      toolName: tool.name,
      level: tool.permissionLevel,
      summary,
      details: { callId: call.id },
      sessionId: context.sessionId,
    });

    const decision = await this.#permissions.authorize(request);

    if (decision.type !== "allow") {
      this.#logger.info("tool call denied", { tool: tool.name, callId: call.id });
      return { status: "denied", decision };
    }

    const startedAt = context.now();
    try {
      const result = (await tool.execute(call.input, context)) as ToolResult<Output>;
      return { status: "completed", result };
    } catch (cause) {
      // A tool that throws must not take the whole agent down, and must not report success.
      const message = cause instanceof Error ? cause.message : String(cause);
      this.#logger.error("tool execution threw", { tool: tool.name, error: message });
      return {
        status: "completed",
        result: { ok: false, error: message, durationMs: context.now() - startedAt },
      };
    }
  }
}

/** Creates a `ToolCall` with a generated id. */
export function createToolCall<Input>(
  toolName: string,
  input: Input,
  options: { readonly requestedBy?: string; readonly now?: number } = {},
): ToolCall<Input> {
  return {
    id: newId("call"),
    toolName,
    input,
    requestedBy: options.requestedBy,
    createdAt: options.now ?? Date.now(),
  };
}
