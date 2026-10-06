import { ForgeError } from "@forgeai/shared";

import type { AnyToolDefinition, ToolSummary } from "./tool";

/**
 * Holds the tools ForgeAI currently knows about.
 *
 * The registry is intentionally dumb: it stores and returns tools. Policy decisions belong to
 * the executor and the permission system, not here.
 */
export interface ToolRegistry {
  register(tool: AnyToolDefinition): void;
  get(name: string): AnyToolDefinition | undefined;
  has(name: string): boolean;
  /** Schema-only descriptions, safe to hand to an AI model or the settings UI. */
  list(): readonly ToolSummary[];
}

export class InMemoryToolRegistry implements ToolRegistry {
  readonly #tools = new Map<string, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    if (this.#tools.has(tool.name)) {
      throw new ForgeError("INVALID_INPUT", `A tool named "${tool.name}" is already registered.`);
    }
    this.#tools.set(tool.name, tool);
  }

  get(name: string): AnyToolDefinition | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  list(): readonly ToolSummary[] {
    return [...this.#tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      permissionLevel: tool.permissionLevel,
    }));
  }
}
