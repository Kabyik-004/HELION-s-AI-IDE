import type { FileSystemPort } from "@forgeai/shared";

/**
 * Reads a file for the editor.
 *
 * A leaf feature: it depends only on the file system port and knows nothing about tabs, buffers or
 * the store. That is what lets the editor use it without depending on the rest of file management.
 */
export type ReadFileResult =
  | { readonly kind: "text"; readonly text: string; readonly size: number; readonly modifiedAt: number }
  | { readonly kind: "binary"; readonly size: number }
  | { readonly kind: "tooLarge"; readonly size: number };

/**
 * Reads a file and reports its modification time alongside the contents.
 *
 * The modification time is captured in the same operation because the editor needs it to notice
 * later changes on disk; a separate `stat` would be a second round trip and a second chance to
 * race.
 */
export async function readFile(fileSystem: FileSystemPort, path: string): Promise<ReadFileResult> {
  const content = await fileSystem.readFile(path);
  if (content.kind !== "text") return { kind: content.kind, size: content.size };

  let modifiedAt = 0;
  try {
    modifiedAt = (await fileSystem.stat(path)).modifiedAt;
  } catch {
    // Not fatal: the file is readable, it just cannot be watched for external changes.
  }
  return { kind: "text", text: content.text, size: content.size, modifiedAt };
}
