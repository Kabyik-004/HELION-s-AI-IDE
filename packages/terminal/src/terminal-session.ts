import type { Disposable } from "@forgeai/shared";

/** Exit information for a finished terminal session. */
export interface TerminalExitInfo {
  /** `null` when the process was killed rather than exiting on its own. */
  readonly exitCode: number | null;
  readonly signal?: string;
}

export interface TerminalSessionOptions {
  /** Absolute working directory. Implementations must confine this to the project root. */
  readonly cwd: string;
  /** Shell to launch. Defaults to the platform shell when omitted. */
  readonly shell?: string;
  readonly cols?: number;
  readonly rows?: number;
  readonly env?: Readonly<Record<string, string>>;
  readonly id?: string;
}

/**
 * A long-lived interactive terminal.
 *
 * This is the *interactive* half of command execution (the user's terminal panel). The
 * one-shot, agent-driven half is `CommandRunnerPort` in `@forgeai/shared`. Both are
 * interfaces in Module 0 — there is no PTY implementation anywhere in the codebase, because
 * ForgeAI must never expose unrestricted shell execution.
 *
 * TODO(module-3): implement this on the Rust side (portable-pty) behind an approval flow.
 */
export interface TerminalSession {
  readonly id: string;
  readonly cwd: string;
  /** Sends keystrokes/input to the process. */
  write(data: string): Promise<void>;
  resize(cols: number, rows: number): void;
  /** Emits output chunks as they are produced. */
  onData(listener: (chunk: string) => void): Disposable;
  onExit(listener: (info: TerminalExitInfo) => void): Disposable;
  kill(): Promise<void>;
}
