import { newId } from "@forgeai/shared";

export type AgentPlanStepStatus = "pending" | "in-progress" | "done" | "skipped" | "failed";

/** One item in the agent's plan. Plans are shown to the user before/while work happens. */
export interface AgentPlanStep {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: AgentPlanStepStatus;
}

export function createPlanStep(
  title: string,
  options: { readonly description?: string; readonly status?: AgentPlanStepStatus } = {},
): AgentPlanStep {
  return {
    id: newId("step"),
    title,
    description: options.description,
    status: options.status ?? "pending",
  };
}

/**
 * A unit of work given to the agent.
 *
 * `goal` is natural language on purpose: translating a developer's intent into a plan is the
 * agent's job, not the caller's. `projectRoot` scopes every tool the agent may use.
 */
export interface AgentTask {
  readonly id: string;
  readonly goal: string;
  readonly projectRoot?: string;
  /** Extra, non-secret context supplied by the caller (open file, selected text, ...). */
  readonly context?: Readonly<Record<string, unknown>>;
  readonly createdAt: number;
}

export function createAgentTask(
  goal: string,
  options: {
    readonly projectRoot?: string;
    readonly context?: Readonly<Record<string, unknown>>;
    readonly now?: number;
  } = {},
): AgentTask {
  return {
    id: newId("task"),
    goal,
    projectRoot: options.projectRoot,
    context: options.context,
    createdAt: options.now ?? Date.now(),
  };
}
