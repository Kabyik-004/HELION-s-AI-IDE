# ForgeAI Architecture

This document describes the architectural decisions behind ForgeAI as established in
**Module 0 (Foundation)**. It is meant to be read alongside the code: every abstraction here
exists as TypeScript in `packages/`.

The guiding principle is simple:

> **Depend on interfaces, not implementations.** The UI must never know whether the AI is
> OpenAI, Anthropic or a local Ollama model, and must never call a shell or the file system
> directly.

---

## 1. High-level shape

```
┌──────────────────────────────────────────────────────────────────────┐
│                         ForgeAI Desktop (Tauri)                       │
│                                                                      │
│   ┌────────────────────────┐        ┌────────────────────────────┐   │
│   │  React UI              │  IPC   │  Rust / Tauri backend      │   │
│   │  (@forgeai/desktop)    │◀──────▶│  (apps/desktop/src-tauri)  │   │
│   └───────────┬────────────┘        └────────────────────────────┘   │
│               │ imports interfaces only                              │
│               ▼                                                       │
│   ┌──────────────────────────────────────────────────────────────┐   │
│   │                      ForgeAI core packages                    │   │
│   │  providers · agent · tools · context · terminal · git ·       │   │
│   │  storage · security · shared                                  │   │
│   └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

There is exactly one direction of dependency for AI-related concerns:

```
UI  ──▶  agent  ──▶  providers
          │
          ├──▶  tools  ──▶  security
          │
          ├──▶  context
          ├──▶  git  ──▶  terminal  ──▶  security
          └──▶  storage
```

No package imports the UI. No package imports a concrete provider SDK (there are none yet).
`@forgeai/shared` sits at the bottom and has **no** internal dependencies.

### Why capability "ports" live in `shared`

Several subsystems need the *same* primitive capabilities:

- tools need to read/write files,
- git needs to run commands,
- providers need to fetch credentials.

If `tools` defined `FileSystemPort` and `git` defined its own, the abstractions would drift.
So the generic capability ports are defined once, in `@forgeai/shared/src/ports`, and
implemented later (Rust side / platform code). This is the classic *ports-and-adapters*
(hexagonal) arrangement.

---

## 2. Package responsibilities

| Package              | Owns                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `@forgeai/shared`    | `Result`, typed emitter, logger, ids, errors, capability ports    |
| `@forgeai/security`  | `PermissionLevel`, `PermissionRequest/Decision`, policy + interceptor |
| `@forgeai/tools`     | `ToolDefinition`, registry, `GuardedToolExecutor`                  |
| `@forgeai/providers` | Provider/model/auth/chat types, `Provider` contract, registry, catalogue |
| `@forgeai/agent`     | `Agent`, `AgentMessage`, `AgentTask`, `AgentEvent`, plan steps    |
| `@forgeai/context`   | `ContextItem`, `ContextProvider`, `ContextEngine`                 |
| `@forgeai/git`       | `GitService` + status/diff/log/commit types                       |
| `@forgeai/terminal`  | Terminal sessions + command request/result types                 |
| `@forgeai/storage`   | `KeyValueStore`, `ConfigService`, `SecureCredentialStore`         |

Rules of thumb used while writing these:

- Types describe **what**, not **how**. Only trivial, genuinely-working implementations are
  included (e.g. an in-memory key/value store). Nothing pretends to work.
- Anything requiring real capability (network, disk, PTY) is an interface plus a clearly
  marked `TODO(module-N)`.

---

## 3. Provider abstraction

The rest of ForgeAI speaks the `Provider` contract; it never speaks `fetch("https://api.openai.com/...")`.

```ts
interface Provider {
  readonly descriptor: ProviderDescriptor;          // id, name, kind, auth, defaultBaseUrl
  listModels(): Promise<readonly ModelInfo[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
  dispose(): Promise<void>;
}
```

Supporting types:

- **`ProviderDescriptor`** — static identity and metadata (safe to show in the UI).
- **`ProviderCapability`** — `chat | streaming | tools | vision | embeddings | reasoning`.
- **`ProviderAuthentication`** — `api-key | oauth | none`, plus a label and docs URL.
- **`ModelInfo`** — model id, name, context window, capabilities.
- **`ChatMessage` / `ChatRequest` / `ChatChunk` / `ChatResponse`** — a provider-neutral chat
  vocabulary. `ChatChunk` is a discriminated union (`text-delta`, `tool-call`, `usage`,
  `done`) so streaming can be rendered incrementally without provider-specific shapes.

Construction is separated from use via a factory, so a provider can be created from
configuration + a credential store without the caller knowing which SDK is involved:

```ts
interface ProviderFactory<TConfig> {
  readonly descriptor: ProviderDescriptor;
  create(options: { config: TConfig; credentials: CredentialStorePort; logger?: Logger }): Provider;
}
```

`DefaultProviderRegistry` maps `ProviderId → ProviderFactory`. **In Module 0 the registry is
empty of factories.** `PROVIDER_CATALOG` contains *metadata only* for OpenAI, Anthropic,
Google Gemini, OpenRouter, Groq, Mistral, Ollama and custom OpenAI-compatible endpoints. This
lets the settings UI list the intended providers today without shipping any fake adapter.

The UI reads the catalogue through this abstraction, which is why no React component contains
provider-specific branching.

---

## 4. Agent abstraction

The agent's job is to turn a goal into a sequence of model calls and tool calls. Module 0
defines the vocabulary and the contract, **not the loop**.

```ts
interface Agent {
  readonly id: string;
  readonly config: AgentConfig;                       // providerId, model, maxIterations, systemPrompt
  run(task: AgentTask, signal?: AbortSignal): AsyncIterable<AgentEvent>;
}
```

- **`AgentMessage`** — the agent's own message history (richer roles than raw chat:
  `system | user | assistant | tool | observation`).
- **`AgentTask`** — an id, a natural-language goal, an optional project root and extra context.
- **`AgentTool`** — the agent-facing *view* of a tool (name, description, schema, permission
  level). The executable `ToolDefinition` lives in `@forgeai/tools`; the agent only ever sees
  the metadata, which keeps tool implementation out of the agent.
- **`ToolCall` / `ToolResult`** — reused directly from `@forgeai/tools` to avoid two competing
  definitions of the same concept.
- **`AgentEvent`** — a discriminated union streamed from `run`: `started`, `message`, `plan`,
  `tool-call`, `tool-result`, `observation`, `error`, `finished`.

Because `run` returns an `AsyncIterable<AgentEvent>`, the UI can render the agent's progress
step by step without knowing how the loop is implemented.

---

## 5. Planned agent execution flow (Module 6)

The loop below is the target design. It is documented now so today's interfaces do not have to
change later. **None of it is implemented in Module 0.**

```
User goal
   │
   ▼
Agent receives AgentTask
   │
   ▼
Plan ──────────────▶ emit AgentEvent{ type: "plan" }
   │
   ▼
Choose next action
   │
   ▼
Model decides: respond, or call a tool
   │
   ├── respond ──▶ emit AgentEvent{ type: "finished" }
   │
   └── tool call
          │
          ▼
     ToolCall ──▶ PermissionInterceptor.authorize()   ◀── security boundary
          │            │
          │      deny ─┘ (emit error / ask human)
          │
          ▼
     GuardedToolExecutor.execute()
          │
          ▼
     ToolResult ──▶ emit AgentEvent{ type: "tool-result" }
          │
          ▼
     Observation ──▶ emit AgentEvent{ type: "observation" }
          │
          ▼
     Update context & history ──▶ next action (bounded by maxIterations)
```

Key properties of the design:

- The loop is **bounded** (`maxIterations`) so it cannot run forever.
- Every side effect passes through the **same** permission interceptor.
- Verification is a distinct step, so "it ran" and "it worked" are not conflated.
- Events are the only output, so any UI can render the agent.

---

## 6. Tool abstraction

```ts
interface ToolDefinition<Input, Output> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;          // describes inputs for the model
  readonly permissionLevel: PermissionLevel; // SAFE | MODERATE | DANGEROUS
  readonly execute: (input: Input, ctx: ToolExecutionContext) => Promise<ToolResult<Output>>;
}
```

`ToolRegistry` stores tools by name. `GuardedToolExecutor` is the single execution path:

```ts
class GuardedToolExecutor {
  async execute(call, ctx) {
    const tool = registry.get(call.toolName);          // 1. resolve
    const decision = await permissions.authorize(...);  // 2. AUTHORISE (before execution)
    if (decision.type !== "allow") return denied;       // 3. refuse if not allowed
    return tool.execute(call.input, ctx);                // 4. run
  }
}
```

Future tools — `read_file`, `write_file`, `edit_file`, `delete_file`, `list_directory`,
`search_files`, `run_command`, `git_status`, `git_diff`, `git_commit`, browser tools — will be
registered here. **None are implemented in Module 0**, because implementing them without the
permission UX (Module 3) would be exactly the unsafe shortcut the security principle forbids.

---

## 7. Security boundary

Security is enforced at one chokepoint, not sprinkled through tools.

**Levels**

| Level       | Meaning                                            | Default handling            |
| ----------- | -------------------------------------------------- | --------------------------- |
| `SAFE`      | read-only, no external effect                      | may be auto-allowed by policy |
| `MODERATE`  | changes files or runs a read-only command          | requires human approval     |
| `DANGEROUS` | destructive, network-mutating, irreversible        | requires human approval     |

**Flow**

1. A `ToolCall` reaches `GuardedToolExecutor`.
2. It builds a `PermissionRequest` (tool name, level, human-readable summary, details).
3. `PermissionPolicy.evaluate()` returns `allow | deny | ask`.
4. `ask` is delegated to a `PermissionResolver` (the human-facing approval UI, built later).
5. `PermissionManager` combines policy + resolver and caches `session`-scoped grants.
6. Only an `allow` decision reaches `tool.execute`.

The `PermissionManager` is a real, testable implementation. The `PermissionResolver` is an
interface because the approval UI belongs to a later module.

**Non-negotiables**

- No `child_process`/shell execution exists anywhere in the codebase.
- No file system access exists in TypeScript yet; it is modelled by `FileSystemPort`.
- API keys are modelled as opaque secret references, never as config values.
- The Tauri config uses a restrictive-by-default posture; capabilities are opt-in per window.

---

## 8. Frontend ↔ backend communication

Two channels exist, and they are deliberately kept apart.

**1. In-process TypeScript (today's default).**
The React app imports the ForgeAI packages directly and calls their interfaces. This is why
Module 0 can offer a provider/model settings UI, a config service and a permission manager
without any Rust code — the logic is provider-neutral and side-effect free.

**2. Tauri IPC (grows in later modules).**
When an operation needs a real OS capability (disk, PTY, keychain), it will be implemented in
Rust and exposed as a Tauri command, then wrapped behind the matching port:

```
React component
   │ calls
   ▼
TypeScript port (e.g. FileSystemPort)
   │ implemented by
   ▼
Tauri IPC wrapper  ──invoke──▶  Rust command  ──▶  OS
```

Rules for this channel:

- The Rust command surface stays **minimal and explicit**. No generic "run anything" command.
- Every command that mutates state is registered in `src-tauri/capabilities/` with the least
  privilege it needs.
- The IPC wrapper is the *only* place that knows about `@tauri-apps/api`, so the UI and core
  packages remain backend-agnostic.

In Module 0 the only command is `app_info`, which returns the product name and version. It is
used by the status bar to prove the IPC round-trip works end to end.

---

## 9. Configuration & credentials

Two separate concerns, two separate stores:

- **`ConfigService`** (over a `KeyValueStore`) holds *preferences*: selected provider/model,
  recent projects, agent settings, permission settings, UI preferences. It is plain data and
  safe to serialize.
- **`SecureCredentialStore`** holds *secrets*. Its interface is intentionally tiny
  (`setSecret`, `getSecret`, `deleteSecret`, `hasSecret`) because it is destined to be backed
  by the OS keychain. It is never represented as a config value.

The current `KeyValueStore`/`SecureCredentialStore` implementations are in-memory and clearly
labelled as such. `InMemoryCredentialStore` carries an explicit **NOT SECURE** warning and
exists only so the app can run during development. Persistence and keychain integration are
Module 1 work.

---

## 10. Extension points for later modules

| To add…                      | Implement…                                              | Without touching…        |
| ---------------------------- | ------------------------------------------------------- | ------------------------ |
| A new AI provider            | `ProviderFactory` + `Provider`                          | the UI, the agent        |
| A new tool                   | `ToolDefinition`, register it                           | the executor, the UI     |
| A new context source         | `ContextProvider`                                       | the context engine       |
| Real file access             | `FileSystemPort` (Rust)                                 | tools, agent             |
| Real terminal                | `TerminalService` + `CommandRunnerPort` (Rust)          | git, tools               |
| Real Git                     | `GitService`                                            | UI, context              |
| Persistence                  | `KeyValueStore` / `SecureCredentialStore`               | config service, UI       |

Each row is a drop-in replacement because Module 0 depends on the interface, not the
implementation. That is the whole point of this module.
