/**
 * Error type used across ForgeAI packages.
 *
 * A stable `code` lets callers branch on failures without matching on message text,
 * which keeps error handling independent of wording (and of localisation later).
 */
export type ForgeErrorCode =
  /** Deliberately unimplemented in this module; see the accompanying TODO. */
  | "NOT_IMPLEMENTED"
  /** The permission system refused the operation. */
  | "PERMISSION_DENIED"
  /** The caller supplied something invalid. */
  | "INVALID_INPUT"
  /** A dependency that should exist is missing or unreachable. */
  | "UNAVAILABLE"
  /** Something unexpected went wrong. */
  | "INTERNAL";

export interface ForgeErrorOptions {
  readonly cause?: unknown;
  readonly details?: Readonly<Record<string, unknown>>;
}

export class ForgeError extends Error {
  readonly code: ForgeErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: ForgeErrorCode, message: string, options: ForgeErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ForgeError";
    this.code = code;
    this.details = options.details;
  }

  static notImplemented(what: string, module: string): ForgeError {
    return new ForgeError("NOT_IMPLEMENTED", `${what} is not implemented yet (planned for ${module}).`);
  }
}

/** Type guard for `ForgeError`. */
export function isForgeError(value: unknown): value is ForgeError {
  return value instanceof ForgeError;
}
