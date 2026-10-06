import { deny, type PermissionDecision, type PermissionRequest } from "./permission-request";

/**
 * The human-facing half of the permission system.
 *
 * A resolver is whatever presents an approval prompt to the developer and returns their
 * answer. It is an interface because the approval UI is built in a later module; keeping it
 * abstract now means `PermissionManager` can be tested and reasoned about today.
 */
export interface PermissionResolver {
  resolve(request: PermissionRequest): Promise<PermissionDecision>;
}

/**
 * A resolver that refuses everything.
 *
 * This is the safe default when no UI is connected: if ForgeAI has nobody to ask, it must
 * not act. It is a real, intentional implementation — not a placeholder.
 */
export class DenyAllResolver implements PermissionResolver {
  async resolve(request: PermissionRequest): Promise<PermissionDecision> {
    return deny(`No approval channel is connected, so "${request.toolName}" was refused.`);
  }
}
