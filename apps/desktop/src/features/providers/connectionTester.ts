import { codeForStatus } from "@forgeai/providers";
import type { CredentialStorePort, Logger } from "@forgeai/shared";

import { probeFor } from "../ai-providers/probes";

/** What a connection test needs. Contains no secret — the key is read from the store. */
export interface ConnectionTestRequest {
  readonly providerType: string;
  readonly providerName: string;
  readonly baseUrl: string;
  /** Opaque credential id, e.g. `provider:openai-personal:apiKey`. */
  readonly credentialId: string;
}

export interface ConnectionTestResult {
  readonly ok: boolean;
  /** Human-readable outcome. Never contains a credential. */
  readonly message: string;
  /** Developer-facing context, shown behind a Details toggle. */
  readonly detail?: string;
}

/**
 * Answers "are this configuration and credential usable against the real endpoint?".
 *
 * A port, so the answer can come from the renderer today and from Rust later without the UI
 * noticing. Tests substitute a fake.
 */
export interface ConnectionTester {
  test(request: ConnectionTestRequest): Promise<ConnectionTestResult>;
}

const TIMEOUT_MS = 15_000;

/**
 * Performs the probe with `fetch` from the renderer.
 *
 * Provider APIs are plain HTTPS endpoints. Most of them (Google, OpenRouter, Ollama and custom
 * endpoints) accept browser-origin requests, and Anthropic does when asked explicitly; OpenAI does
 * not. When a request fails the message says so plainly — including that the provider may simply
 * refuse browser-origin requests — rather than pretending the provider is down.
 */
export function createFetchConnectionTester(credentials: CredentialStorePort, logger: Logger): ConnectionTester {
  return {
    async test(request) {
      const probe = probeFor(request.providerType);
      if (probe === undefined) {
        return { ok: false, message: `Connection testing is not available for ${request.providerName} yet.` };
      }

      let url: URL;
      try {
        url = new URL(`${request.baseUrl.replace(/\/+$/, "")}${probe.path}`);
      } catch {
        return { ok: false, message: `The ${request.providerName} base URL is not valid.` };
      }

      const headers: Record<string, string> = { ...(probe.headers ?? {}) };
      if (probe.auth.kind !== "none") {
        const secret = await credentials.get({ id: request.credentialId });
        if (secret === undefined || secret.length === 0) {
          return { ok: false, message: `No API key is configured for ${request.providerName}.` };
        }
        if (probe.auth.kind === "bearer") headers.Authorization = `Bearer ${secret}`;
        else if (probe.auth.kind === "header") headers[probe.auth.name] = secret;
        else url.searchParams.set(probe.auth.param, secret);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        logger.info("provider connection probe", { providerType: request.providerType, path: probe.path });
        const response = await fetch(url, { method: probe.method, headers, signal: controller.signal });
        if (response.ok) return { ok: true, message: `Connected to ${request.providerName}.` };

        const code = codeForStatus(response.status);
        const message =
          code === "authenticationFailed"
            ? `${request.providerName} rejected the API key.`
            : code === "rateLimited"
              ? `${request.providerName} is rate limiting requests.`
              : `${request.providerName} returned HTTP ${response.status}.`;
        return { ok: false, message, detail: `HTTP ${response.status}` };
      } catch (cause) {
        const aborted = typeof cause === "object" && cause !== null && (cause as { name?: unknown }).name === "AbortError";
        return {
          ok: false,
          message: aborted
            ? `${request.providerName} did not respond within ${TIMEOUT_MS / 1000}s.`
            : `Could not reach ${request.providerName}. The endpoint may be unreachable, or the provider may refuse browser-origin requests.`,
          detail: cause instanceof Error ? cause.message : String(cause),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
