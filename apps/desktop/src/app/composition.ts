import { DefaultContextEngine, type ContextEngine } from "@forgeai/context";
import { DefaultProviderRegistry, type ProviderRegistry } from "@forgeai/providers";
import { createDefaultPolicy, DenyAllResolver, PermissionManager } from "@forgeai/security";
import { createLogger, type CredentialStorePort, type Logger } from "@forgeai/shared";
import {
  CredentialStoreAdapter,
  DefaultConfigService,
  InMemoryCredentialStore,
  InMemoryKeyValueStore,
  type ConfigService,
  type KeyValueStore,
  type SecureCredentialStore,
} from "@forgeai/storage";
import { GuardedToolExecutor, InMemoryToolRegistry, type ToolExecutor, type ToolRegistry } from "@forgeai/tools";

import { isTauri } from "../infrastructure/ipc/isTauri";
import { TauriKeyValueStore } from "../infrastructure/storage/tauriKeyValueStore";
import { createWorkspaceService, type WorkspaceService } from "../infrastructure/filesystem/workspaceService";

/**
 * The composition root.
 *
 * This is the **only** place that chooses concrete implementations. Every other module — including
 * every React component — receives its collaborators as interfaces. That is what makes each
 * subsystem independently replaceable, and it is exactly what Module 2 relied on: opening a real
 * folder required new implementations here and no changes to the explorer or the editor.
 *
 * The environment decides two things:
 *
 *  - **Key/value storage.** Inside Tauri, preferences persist to the application config file;
 *    in a browser they are in memory.
 *  - **The file system.** Inside Tauri, real workspace access through Rust; in a browser, the
 *    bundled example project.
 */
export interface ForgeAIServices {
  readonly logger: Logger;
  /** True when running inside the Tauri desktop shell. */
  readonly native: boolean;
  readonly config: ConfigService;
  readonly credentialStore: SecureCredentialStore;
  readonly credentials: CredentialStorePort;
  readonly providerRegistry: ProviderRegistry;
  readonly toolRegistry: ToolRegistry;
  readonly toolExecutor: ToolExecutor;
  readonly permissions: PermissionManager;
  readonly contextEngine: ContextEngine;
  /** Which folder is open, and the `FileSystemPort` bound to it. */
  readonly workspace: WorkspaceService;
}

export function createServices(): ForgeAIServices {
  const logger = createLogger("desktop");
  const native = isTauri();

  // Preferences: the real file on the desktop, memory in a browser.
  const store: KeyValueStore = native ? new TauriKeyValueStore() : new InMemoryKeyValueStore();
  const config = new DefaultConfigService({ store, logger: logger.child("config") });

  const credentialStore = new InMemoryCredentialStore();
  const credentials = new CredentialStoreAdapter(credentialStore);

  const providerRegistry = new DefaultProviderRegistry();
  const toolRegistry = new InMemoryToolRegistry();

  // Deny-all until an approval dialog exists. ForgeAI must never act without a human when it has
  // no way to ask one.
  const permissions = new PermissionManager({
    policy: createDefaultPolicy(),
    resolver: new DenyAllResolver(),
    logger: logger.child("permissions"),
    rememberSessionGrants: true,
  });

  const toolExecutor = new GuardedToolExecutor({
    registry: toolRegistry,
    permissions,
    logger: logger.child("tools"),
  });

  const contextEngine = new DefaultContextEngine();

  const workspace = createWorkspaceService(native, logger.child("workspace"));

  return {
    logger,
    native,
    config,
    credentialStore,
    credentials,
    providerRegistry,
    toolRegistry,
    toolExecutor,
    permissions,
    contextEngine,
    workspace,
  };
}
