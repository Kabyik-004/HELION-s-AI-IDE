/**
 * @forgeai/security
 *
 * ForgeAI's security primitives: how dangerous an action is, how that danger is evaluated,
 * and the single gate that every side effect must pass through.
 *
 * The most important export is `PermissionInterceptor`. It is injected into the tool
 * executor, which refuses to run a tool unless `authorize()` returns an `allow`.
 */

export * from "./permission-level";
export * from "./permission-request";
export * from "./permission-policy";
export * from "./permission-resolver";
export * from "./permission-manager";
