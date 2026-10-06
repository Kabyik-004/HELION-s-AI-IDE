/**
 * Capability "ports".
 *
 * These are the boundaries where ForgeAI will eventually touch the outside world.
 * They are declared here (rather than inside `tools`, `git`, `terminal`, ...) so that every
 * subsystem agrees on one definition, and so the implementations can be swapped without
 * touching the consumers.
 *
 * Module 0 intentionally ships **no implementations** of these ports. Real implementations
 * arrive in later modules, most likely on the Rust side of Tauri.
 *
 * TODO(module-4): implement `CommandRunnerPort` via a permission-gated terminal.
 * TODO(module-3): implement `CredentialStorePort` via the OS keychain.
 */

export type {
  FileSystemPort,
  DirEntry,
  DirectoryListing,
  FileStat,
  FileContent,
  EntryKind,
  ReadDirectoryOptions,
} from "./filesystem";
export { FileSystemError } from "./filesystem-error";
export type { FileSystemErrorCode } from "./filesystem-error";
export type { CommandRunnerPort, CommandRequest, CommandResult } from "./command";
export type { CredentialStorePort, SecretReference } from "./credentials";
