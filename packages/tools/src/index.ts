/**
 * @forgeai/tools
 *
 * The generic tool contract, a registry, and the permission-guarded executor that is the
 * only way a tool may ever run.
 *
 * Module 0 defines the abstraction and the enforcement point. No concrete tools exist yet
 * (`read_file`, `run_command`, `git_commit`, ...) because implementing them safely depends on
 * the approval experience from Module 3.
 *
 * TODO(module-2): implement file system tools behind `ToolDefinition`.
 * TODO(module-3): implement `run_command` with an explicit approval prompt.
 * TODO(module-4): implement git tools.
 */

export * from "./json-schema";
export * from "./tool";
export * from "./tool-registry";
export * from "./tool-executor";
