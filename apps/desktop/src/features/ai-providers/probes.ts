/**
 * Connection probes.
 *
 * A probe is a small, **non-secret** description of the request that answers "is this provider
 * reachable with this key?". Keeping the shape as data means the connectivity code has no
 * provider-specific branching, and adding a provider is a data change rather than a code change.
 *
 * Probes contain no credentials and no credential-shaped fields — the key is added at request
 * time from the credential store and is never stored here.
 */

export type ProbeAuth =
  | { readonly kind: "bearer" }
  | { readonly kind: "header"; readonly name: string }
  | { readonly kind: "query"; readonly param: string }
  | { readonly kind: "none" };

export interface ConnectionProbe {
  /** Path appended to the base URL, e.g. `/models`. */
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly auth: ProbeAuth;
  /** Extra non-secret headers the provider requires. */
  readonly headers?: Readonly<Record<string, string>>;
  /** What the probe does, shown while a test is running. */
  readonly label: string;
}

const PROBES: Readonly<Record<string, ConnectionProbe>> = {
  openai: { path: "/models", method: "GET", auth: { kind: "bearer" }, label: "List models" },
  openrouter: { path: "/models", method: "GET", auth: { kind: "bearer" }, label: "List models" },
  groq: { path: "/models", method: "GET", auth: { kind: "bearer" }, label: "List models" },
  mistral: { path: "/models", method: "GET", auth: { kind: "bearer" }, label: "List models" },
  ollama: { path: "/api/tags", method: "GET", auth: { kind: "none" }, label: "List local models" },
  "custom-openai-compatible": { path: "/models", method: "GET", auth: { kind: "bearer" }, label: "List models" },
  anthropic: {
    path: "/v1/models",
    method: "GET",
    auth: { kind: "header", name: "x-api-key" },
    // Anthropic serves browser-origin requests only when asked explicitly.
    headers: { "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    label: "List models",
  },
  google: { path: "/v1beta/models", method: "GET", auth: { kind: "query", param: "key" }, label: "List models" },
};

/** The probe for a provider type, or `undefined` when connectivity testing is not supported. */
export function probeFor(providerType: string): ConnectionProbe | undefined {
  return PROBES[providerType];
}
