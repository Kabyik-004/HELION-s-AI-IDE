import { FileSystemError } from "@forgeai/shared";

/**
 * Turns anything a file operation threw into words a developer can act on.
 *
 * The backend already produces friendly wording, so it is preferred over anything generic; a raw
 * error is never shown as-is. Kept pure and dependency-free so any feature can use it.
 */
export interface DescribedError {
  readonly message: string;
  /** Technical context for developers, shown behind a "Details" affordance. */
  readonly detail: string | undefined;
}

export function describeFileSystemError(cause: unknown, fallback: string): DescribedError {
  if (cause instanceof FileSystemError) {
    return { message: cause.message, detail: cause.detail };
  }
  if (cause instanceof Error && cause.message.length > 0) {
    return { message: cause.message, detail: cause.stack };
  }
  return { message: fallback, detail: String(cause) };
}
