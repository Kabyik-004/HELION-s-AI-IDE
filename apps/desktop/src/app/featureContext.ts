import type { FileSystemPort, Logger } from "@forgeai/shared";

import type { DialogService } from "../features/dialogs/dialogService";
import type { Notify } from "../features/notifications/notify";
import type { ProviderService } from "../features/providers/providerService";
import type { WorkspaceService } from "../infrastructure/filesystem/workspaceService";
import type { IdeAction } from "./ideActions";
import type { IdeState } from "./ideTypes";

/** Read/write access to the recently opened folders list (persisted by the config service). */
export interface RecentProjectsPort {
  list(): readonly string[];
  remember(path: string): Promise<void>;
}

/**
 * What every feature operation is given.
 *
 * A feature receives its dependencies; it never imports the store, the file system, another
 * feature, or a platform API directly. That is what makes a feature unit-testable with a fake
 * port and a fake dialog service.
 *
 * An operation is therefore a plain factory returning plain functions:
 *
 * ```ts
 * export function createDeletePathFeature(deps: FeatureDeps) {
 *   return { async deletePath(path: string) { ... } };
 * }
 * ```
 */
export interface FeatureDeps {
  /** The file system for the open workspace, or `null` when no folder is open. */
  readonly fileSystem: () => FileSystemPort | null;
  /** Which folder is open, and how to change it. */
  readonly workspace: WorkspaceService;
  readonly recentProjects: RecentProjectsPort;
  /** Reads the current state. Safe to call inside an operation; always up to date. */
  readonly getState: () => IdeState;
  readonly dispatch: (action: IdeAction) => void;
  /** Provider configuration and credentials. Never touched directly by a component. */
  readonly providers: ProviderService;
  /** Asks the developer a question and awaits the answer. */
  readonly dialogs: DialogService;
  /** Reports an outcome to the developer. */
  readonly notify: Notify;
  readonly logger: Logger;
}
