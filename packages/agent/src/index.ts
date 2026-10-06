/**
 * @forgeai/agent
 *
 * The agent vocabulary: what an agent is, what it is given, and what it emits.
 *
 * Module 0 establishes interfaces and types only. The execution loop is Module 7. Even then,
 * the agent will reach the outside world exclusively through `@forgeai/tools` (which is
 * permission-guarded) and `@forgeai/providers`, so this package never performs a side effect
 * itself.
 */

export * from "./message";
export * from "./task";
export * from "./tool";
export * from "./event";
export * from "./agent";
