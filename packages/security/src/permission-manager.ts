import { createLogger, newId, type Logger } from "@forgeai/shared";

import type { PermissionLevel } from "./permission-level";
import type { PermissionPolicy } from "./permission-policy";
import {
  allow,
  deny,
  type PermissionDecision,
  type PermissionRequest,
} from "./permission-request";
import type { PermissionResolver } from "./permission-resolver";

/**
 * The mandatory gate in front of every side-effecting operation.
 *
 * Anything that can change the world (a tool, a command, a git commit) must call
 * `authorize()` and must refuse to proceed unless the decision is `allow`.
 */
export interface PermissionInterceptor {
  authorize(request: PermissionRequest): Promise<PermissionDecision>;
}

export interface PermissionManagerOptions {
  readonly policy: PermissionPolicy;
  readonly resolver: PermissionResolver;
  readonly logger?: Logger;
  /**
   * When true, an approval given with `session` scope is remembered for the rest of the
   * session. `DANGEROUS` actions are never remembered, regardless of this flag.
   */
  readonly rememberSessionGrants?: boolean;
}

/** Fields used to decide whether two requests are "the same action". */
export interface DescribePermissionInput {
  readonly toolName: string;
  readonly level: PermissionLevel;
  readonly summary: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly sessionId?: string;
}

/** Builds a fully-populated `PermissionRequest`. */
export function describePermission(input: DescribePermissionInput, now: number = Date.now()): PermissionRequest {
  return {
    id: newId("perm"),
    toolName: input.toolName,
    level: input.level,
    summary: input.summary,
    details: input.details,
    requestedAt: now,
    sessionId: input.sessionId,
  };
}

/**
 * Combines an automatic policy with a human resolver.
 *
 * Order of operations:
 *   1. a previously remembered session grant (never for `DANGEROUS`),
 *   2. the automatic policy,
 *   3. the human resolver when the policy says `ask`.
 */
export class PermissionManager implements PermissionInterceptor {
  readonly #policy: PermissionPolicy;
  readonly #resolver: PermissionResolver;
  readonly #logger: Logger;
  readonly #remember: boolean;

  /** Grants remembered for this session, keyed by tool + level. */
  readonly #sessionGrants = new Set<string>();

  constructor(options: PermissionManagerOptions) {
    this.#policy = options.policy;
    this.#resolver = options.resolver;
    this.#logger = options.logger ?? createLogger("security");
    this.#remember = options.rememberSessionGrants ?? true;
  }

  async authorize(request: PermissionRequest): Promise<PermissionDecision> {
    const grantKey = sessionGrantKey(request);

    if (this.canRemember(request) && this.#sessionGrants.has(grantKey)) {
      this.#logger.debug("permission granted from session cache", { tool: request.toolName });
      return allow("session");
    }

    const evaluation = this.#policy.evaluate(request);

    if (evaluation.type === "allow") {
      this.#logger.debug("permission auto-allowed by policy", { tool: request.toolName });
      return allow("once");
    }

    if (evaluation.type === "deny") {
      this.#logger.info("permission denied by policy", { tool: request.toolName });
      return deny(evaluation.reason);
    }

    const decision = await this.#resolver.resolve(request);
    this.remember(request, decision, grantKey);
    return decision;
  }

  /** Forgets every remembered approval (for example when a project is closed). */
  revokeSessionGrants(): void {
    this.#sessionGrants.clear();
  }

  /** Remembers an approval when the caller asked for it and it is safe to do so. */
  private remember(request: PermissionRequest, decision: PermissionDecision, grantKey: string): void {
    if (decision.type !== "allow") return;
    if (decision.scope !== "session") return;
    if (!this.canRemember(request)) return;
    this.#sessionGrants.add(grantKey);
  }

  /** `DANGEROUS` actions are never remembered; neither are actions when remembering is off. */
  private canRemember(request: PermissionRequest): boolean {
    return this.#remember && request.level !== "DANGEROUS";
  }
}

function sessionGrantKey(request: PermissionRequest): string {
  // NOTE: a remembered grant currently covers every invocation of the same tool at the same
  // level, not just the exact input that was approved. That is acceptable for read-oriented
  // tools but too broad for file writes. TODO(module-3): scope grants to a fingerprinted
  // request (for example tool + path + level) when the approval dialog is built.
  return `${request.level}:${request.toolName}`;
}

/** Narrowing helper used by callers that want a `boolean` instead of a decision. */
export function isAllowed(decision: PermissionDecision): decision is Extract<PermissionDecision, { type: "allow" }> {
  return decision.type === "allow";
}
