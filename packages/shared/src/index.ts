/**
 * @forgeai/shared
 *
 * Cross-cutting primitives used by every other ForgeAI package. This package has **no
 * dependencies on other ForgeAI packages**, which is what lets it sit at the bottom of the
 * dependency graph without creating cycles.
 */

export * from "./result";
export * from "./errors";
export * from "./ids";
export * from "./disposable";
export * from "./events";
export * from "./logger";

// Capability ports (interfaces only until an implementation module lands — see ./ports/index.ts).
export type {
  FileSystemPort,
  DirEntry,
  DirectoryListing,
  FileStat,
  FileContent,
  EntryKind,
  ReadDirectoryOptions,
  CommandRunnerPort,
  CommandRequest,
  CommandResult,
  CredentialStorePort,
  SecretReference,
} from "./ports";
// `FileSystemError` is a value (a class), so it is re-exported separately from the type-only
// block above.
export { FileSystemError } from "./ports";
export type { FileSystemErrorCode } from "./ports";
