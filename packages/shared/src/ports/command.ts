export interface CommandRequest {
  readonly command: string;
  readonly args?: readonly string[];
  /** Working directory. Implementations must confine this to the project root. */
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
  /**
   * When true the command string is interpreted by a shell.
   *
   * Shell interpretation is strictly more powerful (and more dangerous) than executing a
   * program with an argument array, so it is opt-in and must be treated as a `DANGEROUS`
   * tool by whatever exposes it.
   */
  readonly useShell?: boolean;
}

export interface CommandResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

/**
 * Executes a single command and waits for it to finish.
 *
 * There is deliberately **no implementation** in Module 0. Restricting command execution
 * correctly requires the permission UX from Module 4, and shipping an "execute anything"
 * function now would violate ForgeAI's security principle.
 */
export interface CommandRunnerPort {
  run(request: CommandRequest): Promise<CommandResult>;
}
