import { newId } from "@forgeai/shared";
import type { ProviderId } from "@forgeai/providers";

import type { AgentEvent } from "./event";
import type { AgentTask } from "./task";

/**
 * How an agent is configured for one conversation.
 *
 * `providerId` + `model` are plain identifiers: the agent talks to the `Provider` it is
 * handed by the engine, never to a specific SDK.
 */
export interface AgentConfig {
  readonly providerId: ProviderId;
  readonly model: string;
  /** Hard bound on the plan → act → observe loop, so it can never run forever. */
  readonly maxIterations: number;
  readonly systemPrompt?: string;
}

/**
 * The agent contract.
 *
 * A `run()` call streams events as the agent works. Cancellation is cooperative via
 * `AbortSignal`, which the loop must forward to providers and tools.
 *
 * TODO(module-7): implement the loop (plan → act → observe → verify → report) as a concrete
 * `Agent`. Module 0 defines only the interface, because the loop depends on providers
 * (Module 3), file tools (Module 2) and the approval UX (Module 4).
 */
export interface Agent {
  readonly id: string;
  readonly config: AgentConfig;
  run(task: AgentTask, signal?: AbortSignal): AsyncIterable<AgentEvent>;
}

/** Creates agents from configuration. Implemented in Module 7. */
export interface AgentEngine {
  createAgent(config: AgentConfig): Agent;
}

/** Builds an `AgentConfig` with sensible defaults. */
export function createAgentConfig(
  input: {
    readonly providerId: ProviderId;
    readonly model: string;
    readonly maxIterations?: number;
    readonly systemPrompt?: string;
  },
): AgentConfig {
  return {
    providerId: input.providerId,
    model: input.model,
    maxIterations: input.maxIterations ?? 25,
    systemPrompt: input.systemPrompt,
  };
}

/** Generates an agent id. Exposed so implementations stay consistent. */
export function newAgentId(): string {
  return newId("agent");
}
