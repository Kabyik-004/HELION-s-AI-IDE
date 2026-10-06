import type { ToolCall, ToolResult, ToolSummary } from "@forgeai/tools";

/**
 * The agent's view of a tool.
 *
 * The agent is given tool *metadata* only — it never holds a reference to a tool's
 * implementation. Execution goes through `GuardedToolExecutor` in `@forgeai/tools`, so the
 * agent cannot bypass permissions even if a model asks it to.
 *
 * Defined as an alias (not a copy) so that the agent's tool schema and the tool registry's
 * schema can never drift apart.
 */
export type AgentTool = ToolSummary;

/**
 * `ToolCall` and `ToolResult` are owned by `@forgeai/tools` and re-exported here because the
 * agent vocabulary refers to them. Re-exporting (rather than redefining) guarantees there is
 * exactly one definition of these concepts in the codebase.
 */
export type { ToolCall, ToolResult };
