/**
 * Front-end validation for new and renamed entry names.
 *
 * Owned by the file-management domain because only its operations create or rename things. It
 * mirrors the rules the Rust backend enforces, so a mistake is reported inline in the dialog
 * instead of as an error after a round trip. It is a convenience only: the backend re-validates
 * every name, because a renderer's checks can never be the security boundary.
 */

/** Characters Windows forbids, plus control characters. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001F]/;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
const MAX_LENGTH = 255;

/** Returns an error message to show, or `undefined` when the name is acceptable. */
export function validateEntryName(rawName: string): string | undefined {
  const name = rawName.trim();
  if (name.length === 0) return "Enter a name.";
  if (name === "." || name === "..") return "That name is not allowed.";
  if (ILLEGAL.test(name)) return 'A name cannot contain  < > : " / \\ | ? *';
  if (name.endsWith(".") || name.endsWith(" ")) return "A name cannot end with a dot or a space.";
  if (RESERVED.test(name)) return "That name is reserved by the operating system.";
  if (name.length > MAX_LENGTH) return "That name is too long.";
  return undefined;
}
