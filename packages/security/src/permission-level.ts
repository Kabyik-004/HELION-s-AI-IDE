/**
 * How much damage an action could do if it were wrong.
 *
 * The level is a property of the *action*, not of who requested it. Model output is never
 * treated as a reason to lower a level.
 */
export type PermissionLevel = "SAFE" | "MODERATE" | "DANGEROUS";

/** Ordered from least to most dangerous. */
export const PERMISSION_LEVELS: readonly PermissionLevel[] = ["SAFE", "MODERATE", "DANGEROUS"];

const RANK: Record<PermissionLevel, number> = { SAFE: 0, MODERATE: 1, DANGEROUS: 2 };

/** True when `level` is at least as dangerous as `threshold`. */
export function isAtLeast(level: PermissionLevel, threshold: PermissionLevel): boolean {
  return RANK[level] >= RANK[threshold];
}
