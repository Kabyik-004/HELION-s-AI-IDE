/**
 * Shared identifier helper.
 *
 * ForgeAI keeps ids as plain strings rather than branded types on purpose: the goal
 * of Module 0 is readability. Domain-specific aliases (for example `ProviderId`) live
 * next to the type they describe.
 */

/** Formats a UUID as a short, prefixed, human-scannable id, e.g. `tool_3f2a9c1b`. */
export function newId(prefix: string): string {
  const random = globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `${prefix}_${random}`;
}
