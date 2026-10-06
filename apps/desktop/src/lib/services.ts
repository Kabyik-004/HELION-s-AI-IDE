import { DefaultContextEngine, type ContextEngine } from "@forgeai/context";
import {
  DefaultProviderRegistry,
  type ProviderRegistry,
} from "@forgeai/providers";
import {
  createDefaultPolicy,
  DenyAllResolver,
  PermissionManager,
} from "@forgeai/security";
import { createLogger, type CredentialStorePort, type Logger } from "@forgeai/shared";
import {
  CredentialStoreAdapter,
  DefaultConfigService,
  InMemoryCredentialStore,
  InMemoryKeyValueStore,
  type ConfigService,
  type SecureCredentialStore,
} from "@forgeai/storage";
import { GuardedToolExecutor, InMemoryToolRegistry, type ToolExecutor, type ToolRegistry } from "@forgeai/tools";

/**
 * The composition root.
 *
 * This is the **only** place that chooses concrete implementations. Every other module —
 * including every React component — receives its collaborators as interfaces. That is what
 * makes each subsystem independently replaceable: swapping the in-memory key/value store for a
 * file-backed one, or the deny-all resolver for a real approval dialog, happens here and
 * nowhere else.
 *
 * Module 0 choices (all deliberate, none pretending to work):
 *  - config is in-memory (TODO module-1: persist),
 *  - credentials are in-memory and NOT secure (TODO module-1: OS keychain),
 *  - the provider registry is empty (TODO module-1: adapters),
 *  - the tool registry is empty (TODO module-2/3/4: tools),
 *  - permissions deny anything that needs approval (no approval UI yet).
 */
export interface ForgeAIServices {
  readonly logger: Logger;
  readonly config: ConfigService;
  readonly credentialStore: SecureCredentialStore;
  readonly credentials: CredentialStorePort;
  readonly providerRegistry: ProviderRegistry;
  readonly toolRegistry: ToolRegistry;
  readonly toolExecutor: ToolExecutor;
  readonly permissions: PermissionManager;
  readonly contextEngine: ContextEngine;
}

export function createServices(): ForgeAIServices {
  const logger = createLogger("desktop");

  const config = new DefaultConfigService({
    store: new InMemoryKeyValueStore(),
    logger: logger.child("config"),
  });

  const credentialStore = new InMemoryCredentialStore();
  const credentials = new CredentialStoreAdapter(credentialStore);

  const providerRegistry = new DefaultProviderRegistry();
  const toolRegistry = new InMemoryToolRegistry();

  // Deny-all until an approval dialog exists. ForgeAI must never act without a human when it
  // has no way to ask one.
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

  return {
    logger,
    config,
    credentialStore,
    credentials,
    providerRegistry,
    toolRegistry,
    toolExecutor,
    permissions,
    contextEngine,
  };
}
