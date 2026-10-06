import type { PermissionRequest } from "./permission-request";

/** The outcome of a purely automatic policy check. */
export type PermissionEvaluation =
  | { readonly type: "allow" }
  | { readonly type: "deny"; readonly reason: string }
  /** Not decided automatically: a human must be asked. */
  | { readonly type: "ask" };

/**
 * Automatic, non-interactive decision making.
 *
 * A policy may only ever *narrow* what is allowed. It can never grant more than the caller
 * already has, and the default policy below never auto-approves `DANGEROUS` actions.
 */
export interface PermissionPolicy {
  evaluate(request: PermissionRequest): PermissionEvaluation;
}

export interface DefaultPolicyOptions {
  /** When false, even `SAFE` actions are escalated to a human. Defaults to true. */
  readonly autoAllowSafe?: boolean;
}

/**
 * The default ForgeAI policy.
 *
 * - `SAFE` may be auto-allowed (read-only, no side effects).
 * - `MODERATE` always asks.
 * - `DANGEROUS` always asks, and `PermissionManager` will not remember the answer.
 */
export function createDefaultPolicy(options: DefaultPolicyOptions = {}): PermissionPolicy {
  const autoAllowSafe = options.autoAllowSafe ?? true;
  return {
    evaluate(request: PermissionRequest): PermissionEvaluation {
      if (request.level === "SAFE") {
        return autoAllowSafe ? { type: "allow" } : { type: "ask" };
      }
      return { type: "ask" };
    },
  };
}
