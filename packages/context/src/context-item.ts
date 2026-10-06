import { newId } from "@forgeai/shared";

export type ContextItemKind = "file" | "directory" | "symbol" | "git" | "note";

/**
 * One piece of project understanding handed to the model.
 *
 * Context is deliberately a flat, serializable list. Ranking, summarising and token-budgeting
 * are the context engine's job; consumers only need "a labelled chunk of text".
 */
export interface ContextItem {
  readonly id: string;
  readonly kind: ContextItemKind;
  /** Human-readable label, e.g. `src/app.ts`. */
  readonly label: string;
  /** Project-relative path, when the item refers to a file.
   *  Always project-relative so the model can act on it without an absolute path leak. */
  readonly path?: string;
  readonly content?: string;
  /** Rough token count, used to fit within a model's context window. */
  readonly estimatedTokens?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createContextItem(
  input: {
    readonly kind: ContextItemKind;
    readonly label: string;
    readonly path?: string;
    readonly content?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  },
): ContextItem {
  return {
    id: newId("ctx"),
    kind: input.kind,
    label: input.label,
    path: input.path,
    content: input.content,
    estimatedTokens: input.content === undefined ? undefined : estimateTokens(input.content),
    metadata: input.metadata,
  };
}

/**
 * A deliberately crude token estimate (~4 characters per token).
 *
 * It exists so budgets can be enforced without a tokenizer dependency. It is not exact, and
 * it is not used for billing — only for trimming context.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
