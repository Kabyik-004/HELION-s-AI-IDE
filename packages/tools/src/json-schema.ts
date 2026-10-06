/**
 * A deliberately small subset of JSON Schema.
 *
 * Tool input schemas are handed to AI models, which expect JSON Schema. Rather than pull in
 * a full schema library (and its dependency tree) in Module 0, ForgeAI defines the handful of
 * keywords its tools will use. It can be widened later without changing tool definitions,
 * because the field is structural.
 *
 * TODO(module-5): validate tool input against this schema before execution.
 */
export interface JsonSchema {
  readonly type?: "object" | "string" | "number" | "integer" | "boolean" | "array" | "null";
  readonly title?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchema;
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly additionalProperties?: boolean | JsonSchema;
}

/** Convenience builder for the common "object with properties" shape. */
export function objectSchema(
  properties: Readonly<Record<string, JsonSchema>>,
  options: { readonly required?: readonly string[]; readonly description?: string } = {},
): JsonSchema {
  return {
    type: "object",
    description: options.description,
    properties,
    required: options.required,
    additionalProperties: false,
  };
}
