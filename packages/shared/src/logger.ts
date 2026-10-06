export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, meta?: Readonly<Record<string, unknown>>): void;
  info(message: string, meta?: Readonly<Record<string, unknown>>): void;
  warn(message: string, meta?: Readonly<Record<string, unknown>>): void;
  error(message: string, meta?: Readonly<Record<string, unknown>>): void;
  /** Creates a logger whose messages are tagged with a narrower scope. */
  child(scope: string): Logger;
}

const PREFIX = "[forgeai]";

/**
 * Console-backed logger.
 *
 * This is a real implementation, not a placeholder: a developer console is a perfectly
 * good log sink for the desktop app. A file/telemetry sink can be added later behind the
 * same `Logger` interface.
 */
export function createLogger(scope: string): Logger {
  const tag = `${PREFIX}[${scope}]`;
  const write = (level: LogLevel, message: string, meta?: Readonly<Record<string, unknown>>) => {
    const args = meta === undefined ? [tag, message] : [tag, message, meta];
    switch (level) {
      case "debug":
        console.debug(...args);
        break;
      case "info":
        console.info(...args);
        break;
      case "warn":
        console.warn(...args);
        break;
      case "error":
        console.error(...args);
        break;
    }
  };

  return {
    debug: (message, meta) => write("debug", message, meta),
    info: (message, meta) => write("info", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    error: (message, meta) => write("error", message, meta),
    child: (childScope) => createLogger(`${scope}:${childScope}`),
  };
}
