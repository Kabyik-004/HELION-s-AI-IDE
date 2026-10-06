/**
 * The error a `FileSystemPort` implementation throws.
 *
 * A stable `code` lets the UI react to specific failures (offer to reload a file that vanished,
 * suggest a different name when one is taken) while `message` stays human-readable. The Tauri
 * backend already produces friendly wording, so `from()` prefers it over anything generic.
 */

export type FileSystemErrorCode =
  | "noWorkspace"
  | "outsideWorkspace"
  | "invalidPath"
  | "invalidName"
  | "notFound"
  | "alreadyExists"
  | "permissionDenied"
  | "notADirectory"
  | "isADirectory"
  | "workspaceRoot"
  | "io";

export class FileSystemError extends Error {
  readonly code: FileSystemErrorCode;
  /** Technical context for developers; never shown to users as-is. */
  readonly detail: string | undefined;

  constructor(code: FileSystemErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "FileSystemError";
    this.code = code;
    this.detail = detail;
  }

  /**
   * Normalises anything thrown by an implementation into a `FileSystemError`.
   *
   * Tauri rejects an `invoke` with the serialised error value, so the recognised shape is
   * `{ code, message, detail? }`. Anything else is wrapped with a generic message so a raw
   * stack trace can never reach the interface.
   */
  static from(cause: unknown): FileSystemError {
    if (cause instanceof FileSystemError) return cause;

    if (typeof cause === "object" && cause !== null) {
      const payload = cause as { code?: unknown; message?: unknown; detail?: unknown };
      if (typeof payload.code === "string" && typeof payload.message === "string") {
        return new FileSystemError(
          payload.code as FileSystemErrorCode,
          payload.message,
          typeof payload.detail === "string" ? payload.detail : undefined,
        );
      }
      if (typeof payload.message === "string") {
        return new FileSystemError("io", payload.message);
      }
    }

    return new FileSystemError("io", "The file system operation failed.");
  }

  /** True when the failure means "that no longer exists", which callers often recover from. */
  get isNotFound(): boolean {
    return this.code === "notFound";
  }
}
