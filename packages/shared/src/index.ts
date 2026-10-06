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

// Capability ports (interfaces only in Module 0 — see ./ports/index.ts).
export type {
  FileSystemPort,
  DirEntry,
  FileStat,
  EntryKind,
  CommandRunnerPort,
  CommandRequest,
  CommandResult,
  CredentialStorePort,
  SecretReference,
} from "./ports";
