import type { ProviderDescriptor } from "@forgeai/providers";

/**
 * Pure validation for provider configuration.
 *
 * Kept free of React and of the service so it can be unit-tested directly and reused by both the
 * form (for immediate feedback) and the service (which never trusts the form).
 */

export interface ProviderDraft {
  readonly id?: string;
  readonly providerType: string;
  readonly displayName: string;
  readonly baseUrl?: string;
  readonly model?: string;
  readonly enabled?: boolean;
}

export interface ValidationIssue {
  readonly field: "providerType" | "displayName" | "baseUrl" | "model" | "credential";
  readonly message: string;
}

export type ValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly ValidationIssue[] };

export interface ValidateDraftOptions {
  readonly descriptors: readonly ProviderDescriptor[];
  /** Ids already in use, so a new instance cannot collide. */
  readonly existingIds: readonly string[];
  /** The id being edited, which is allowed to collide with itself. */
  readonly editingId?: string;
}

const MAX_DISPLAY_NAME = 64;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProviderDraft(draft: ProviderDraft, options: ValidateDraftOptions): ValidationResult {
  const issues: ValidationIssue[] = [];

  const type = draft.providerType.trim();
  if (type.length === 0) {
    issues.push({ field: "providerType", message: "Choose a provider." });
  } else if (!options.descriptors.some((descriptor) => descriptor.id === type)) {
    issues.push({ field: "providerType", message: `“${type}” is not a known provider.` });
  }

  const displayName = draft.displayName.trim();
  if (displayName.length === 0) {
    issues.push({ field: "displayName", message: "Enter a display name." });
  } else if (displayName.length > MAX_DISPLAY_NAME) {
    issues.push({ field: "displayName", message: `Keep the name under ${MAX_DISPLAY_NAME} characters.` });
  }

  const baseUrl = draft.baseUrl?.trim();
  if (baseUrl !== undefined && baseUrl.length > 0 && !isHttpUrl(baseUrl)) {
    issues.push({ field: "baseUrl", message: "Enter a valid http:// or https:// URL." });
  }

  if (draft.id !== undefined && draft.id !== options.editingId && options.existingIds.includes(draft.id)) {
    issues.push({ field: "displayName", message: "That provider is already configured." });
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/** Turns a display name into a url-safe slug used as part of an instance id. */
export function slugify(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length === 0 ? "provider" : slug;
}

/** Builds a unique instance id from the provider type and display name. */
export function makeInstanceId(providerType: string, displayName: string, existingIds: readonly string[]): string {
  const base = `${slugify(providerType)}-${slugify(displayName)}`;
  if (!existingIds.includes(base)) return base;
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existingIds.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}
