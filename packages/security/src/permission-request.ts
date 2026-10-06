import type { PermissionLevel } from "./permission-level";

/**
 * A single, self-contained description of an action that is about to happen.
 *
 * The `summary` is shown verbatim to the developer, so it must be human-readable and
 * must not contain secrets.
 */
export interface PermissionRequest {
  readonly id: string;
  /** Name of the tool or operation requesting access. */
  readonly toolName: string;
  readonly level: PermissionLevel;
  /** Short, human-readable description, e.g. "Overwrite src/app.ts (42 lines changed)". */
  readonly summary: string;
  /** Structured, non-secret context for the approval dialog. */
  readonly details?: Readonly<Record<string, unknown>>;
  /** Unix epoch milliseconds. */
  readonly requestedAt: number;
  /** Groups requests belonging to one agent conversation. */
  readonly sessionId?: string;
}

/**
 * How long an approval lasts.
 *
 * `always` is deliberately not stored by `PermissionManager` yet — persisting a permanent
 * grant needs the settings/credential surface from a later module.
 */
export type PermissionGrantScope = "once" | "session" | "always";

export type PermissionDecision =
  | { readonly type: "allow"; readonly scope: PermissionGrantScope; readonly decidedAt: number }
  | { readonly type: "deny"; readonly reason?: string; readonly decidedAt: number };

export function allow(scope: PermissionGrantScope = "once", now: number = Date.now()): PermissionDecision {
  return { type: "allow", scope, decidedAt: now };
}

export function deny(reason?: string, now: number = Date.now()): PermissionDecision {
  return { type: "deny", reason, decidedAt: now };
}
