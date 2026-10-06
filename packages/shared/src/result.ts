/**
 * `Result` is ForgeAI's explicit alternative to throwing for expected failures.
 *
 * Not every function needs it. Use `Result` when a failure is a normal, callable
 * outcome that the caller is expected to handle (a tool that was denied, a provider
 * that is unreachable). Use exceptions for programmer errors and bugs.
 */
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Creates a successful `Result`. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Creates a failed `Result`. */
export function fail<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard for successful results. */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/** Unwraps a successful `Result`, or throws if it failed. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error instanceof Error ? result.error : new Error(String(result.error));
}
