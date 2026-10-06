/**
 * @forgeai/context
 *
 * How ForgeAI builds an understanding of a project.
 *
 * Module 0 ships the item/provider/engine contracts and a genuinely functional merge engine.
 * The providers themselves (project tree, file reader, symbol index, git diff) are Module 5,
 * because they depend on real file access from Module 2.
 */

export * from "./context-item";
export * from "./context-provider";
export * from "./context-engine";
