/**
 * Provider errors.
 *
 * A provider call can fail for many reasons — a missing key, a rejected key, a rate limit, an
 * unreachable endpoint. They are modelled with a stable `code` so the UI can react to the
 * *kind* of failure while showing a human-readable `message`.
 *
 * SECURITY: a `ProviderError` must never carry an API key, an `Authorization` header, or a raw
 * request/response body that could contain one. `detail` is developer-facing context only.
 */

export type ProviderErrorCode =
  /** No credential is stored, but the provider needs one. */
  | "missingCredential"
  /** The credential exists but was rejected (401/403). */
  | "authenticationFailed"
  /** The endpoint is malformed or returned "not found". */
  | "invalidEndpoint"
  /** The provider could not be reached (DNS, connection, CORS, timeout). */
  | "networkError"
  /** The provider is reachable but unhealthy or returned an unexpected status. */
  | "providerUnavailable"
  /** Too many requests (429). */
  | "rateLimited"
  /** The requested model is not available. */
  | "invalidModel"
  /** The provider does not support this operation. */
  | "unsupportedOperation"
  /** The response could not be understood. */
  | "invalidResponse"
  /** Anything else. */
  | "unknown";

export interface ProviderErrorOptions {
  /** The provider type the failure relates to, e.g. `openai`. */
  readonly providerId?: string;
  /** HTTP status when the failure came from a response. */
  readonly status?: number;
  /** Developer-facing context. Never a secret. */
  readonly detail?: string;
  readonly cause?: unknown;
}

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly providerId: string | undefined;
  readonly status: number | undefined;
  readonly detail: string | undefined;

  constructor(code: ProviderErrorCode, message: string, options: ProviderErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ProviderError";
    this.code = code;
    this.providerId = options.providerId;
    this.status = options.status;
    this.detail = options.detail;
  }

  /** Normalises anything thrown during a provider call into a `ProviderError`. */
  static from(cause: unknown, providerId?: string): ProviderError {
    if (cause instanceof ProviderError) return cause;
    if (cause instanceof Error) {
      return new ProviderError("unknown", cause.message, { providerId, detail: cause.stack });
    }
    return new ProviderError("unknown", "The provider request failed.", { providerId });
  }
}

/** Maps an HTTP status to the most specific provider error code. */
export function codeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return "authenticationFailed";
  if (status === 404) return "invalidEndpoint";
  if (status === 429) return "rateLimited";
  if (status >= 400 && status < 500) return "providerUnavailable";
  if (status >= 500) return "providerUnavailable";
  return "unknown";
}
