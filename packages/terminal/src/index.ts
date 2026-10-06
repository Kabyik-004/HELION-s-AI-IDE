/**
 * @forgeai/terminal
 *
 * The command/terminal boundary.
 *
 * Module 0 ships interfaces only. There is intentionally **no implementation**, and there is
 * no `child_process` import anywhere in the repository. Command execution requires the
 * approval experience from Module 4; until then, ForgeAI has no way to run anything.
 */

export type { TerminalExitInfo, TerminalSession, TerminalSessionOptions } from "./terminal-session";
export type { TerminalService, TerminalServiceFactory } from "./terminal-service";
export type { CommandRequest, CommandResult, CommandRunnerPort } from "@forgeai/shared";
