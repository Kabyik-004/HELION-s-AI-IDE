import type { FileSystemPort } from "@forgeai/shared";

/**
 * Writes a buffer back to disk.
 *
 * A leaf feature: it depends only on the file system port. It returns the new modification time so
 * the caller can record it without a follow-up `stat`.
 */
export async function writeFile(
  fileSystem: FileSystemPort,
  path: string,
  contents: string,
): Promise<{ readonly modifiedAt: number }> {
  await fileSystem.writeTextFile(path, contents);
  try {
    return { modifiedAt: (await fileSystem.stat(path)).modifiedAt };
  } catch {
    // The write succeeded; only the "watch for external changes" timestamp is unavailable.
    return { modifiedAt: 0 };
  }
}
