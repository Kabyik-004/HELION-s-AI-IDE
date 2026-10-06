import type { CommandRunnerPort } from "@forgeai/shared";

import type { TerminalSession, TerminalSessionOptions } from "./terminal-session";

/**
 * Creates and tracks terminal sessions.
 *
 * No implementation exists in Module 0. When one is added it must enforce two invariants:
 *   1. the working directory is inside the opened project, and
 *   2. the session was explicitly approved by the user.
 *
 * TODO(module-4): implement `TerminalService` with a PTY and per-session approval.
 */
export interface TerminalService {
  createSession(options: TerminalSessionOptions): Promise<TerminalSession>;
  listSessions(): readonly TerminalSession[];
  /** Terminates every open session (e.g. when the project is closed). */
  disposeAll(): Promise<void>;
}

/**
 * Injecting `CommandRunnerPort` keeps one-shot command execution and interactive terminals
 * behind the same confinement and permission rules.
 */
export interface TerminalServiceFactory {
  create(options: { readonly commands: CommandRunnerPort }): TerminalService;
}
