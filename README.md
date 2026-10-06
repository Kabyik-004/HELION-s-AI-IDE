# ForgeAI

**ForgeAI is an AI-native desktop IDE.** It is built around a simple idea: a developer
should be able to hand an AI a real development task, and the AI should be able to
understand the project, plan the work, change the code, run tools, verify the result and
report back — while the developer stays in control of what the AI is allowed to do.

ForgeAI is **not** a fork of, or a clone of, any existing IDE or agent. Its architecture is
designed from first principles so that each major subsystem (UI, providers, agent, tools,
context, terminal, git, storage, security) can be replaced independently.

> **Status: Module 0 — Foundation.**
> This module establishes the project structure and the core abstractions only.
> The AI is **not** wired up yet and **no tools actually execute** yet. This is intentional:
> the point of Module 0 is a clean, buildable skeleton that later modules can safely grow into.

---

## Product vision

The long-term goal:

> "Give ForgeAI a development task and let the AI understand the project, plan the work,
> modify the code, run tools, verify the result and report what it did."

To get there, ForgeAI must eventually let a developer:

1. Open a local coding project.
2. Browse and edit project files.
3. Connect an AI provider using their own API key.
4. Select an AI model.
5. Chat with the AI about the project.
6. Give the AI access to controlled tools.
7. Allow the AI to read, modify, create and delete project files.
8. Allow the AI to execute terminal commands with permission controls.
9. Understand project context automatically.
10. Inspect Git changes.
11. Run autonomous coding tasks.

Module 0 builds the foundation these capabilities will plug into.

---

## Architecture overview

ForgeAI is an **npm workspace monorepo**. There is one desktop application and a set of
independent packages. Packages depend on **interfaces**, never on each other's internals.

```
apps/desktop          The Tauri + React application shell (UI only)
packages/
  shared              Cross-cutting primitives + capability "ports"
  security            Permission levels, policies, the pre-execution interceptor
  tools               Tool abstraction, registry, permission-guarded executor
  providers           AI provider abstraction (OpenAI, Anthropic, ... adapters later)
  agent               Agent / message / task / event abstractions
  context             Project-context abstraction
  git                 Git service abstraction
  terminal            Terminal + command-runner abstractions
  storage             Config + credential storage abstractions
```

### The rule that keeps it modular

The UI never talks to a provider SDK, a shell, or the file system directly. It talks to
**abstractions**. Concrete implementations (a real OpenAI adapter, a real PTY, a real file
system) are added in later modules behind those abstractions.

### Security boundary

Every tool carries a `PermissionLevel` (`SAFE`, `MODERATE`, `DANGEROUS`). The
`GuardedToolExecutor` in `@forgeai/tools` calls the `PermissionInterceptor` from
`@forgeai/security` **before** a tool body runs, and refuses to run it unless the decision is
`allow`. There is **no unrestricted shell execution** anywhere in the codebase — the terminal
package defines interfaces only.

See [`docs/architecture.md`](docs/architecture.md) for the detailed design.

---

## Technology stack

| Concern          | Choice                                  | Notes                                              |
| ---------------- | --------------------------------------- | -------------------------------------------------- |
| Desktop shell    | [Tauri 2](https://tauri.app)            | Rust backend, small binaries, native OS integration |
| UI               | [React 19](https://react.dev)           | Frontend only; no AI logic in components           |
| Language         | TypeScript (strict)                     | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| Styling          | [Tailwind CSS 4](https://tailwindcss.com) | Utility-first, no runtime CSS-in-JS              |
| Editor           | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | The editor that powers VS Code   |
| Build tool       | [Vite](https://vite.dev)                | Fast dev server + production bundler               |
| Package manager  | npm workspaces                          | No external monorepo tool required                 |

The Rust side (Tauri) is intentionally minimal in Module 0: it starts the app window and
exposes a single `app_info` command. Real backend capabilities (file system, PTY, keychain)
arrive in later modules behind the TypeScript ports defined here.

---

## Directory structure

```
forgeai/
├── apps/
│   └── desktop/
│       ├── src/                 # React application (UI only)
│       │   ├── components/
│       │   ├── state/
│       │   └── lib/
│       └── src-tauri/           # Rust/Tauri shell
│           ├── src/
│           ├── capabilities/
│           ├── icons/
│           ├── Cargo.toml
│           └── tauri.conf.json
├── packages/
│   ├── shared/
│   ├── security/
│   ├── tools/
│   ├── providers/
│   ├── agent/
│   ├── context/
│   ├── git/
│   ├── terminal/
│   └── storage/
├── docs/
│   └── architecture.md
├── tests/
├── scripts/
├── package.json
├── tsconfig.base.json
├── README.md
└── .gitignore
```

---

## Development setup

### Prerequisites

- **Node.js 20+** and **npm 10+**
- **Rust (stable)** — install from <https://rustup.rs>
- **Platform build tools for Tauri:**
  - **Windows:** Microsoft C++ Build Tools (with the *Desktop development with C++* workload)
    and the WebView2 runtime (pre-installed on Windows 11).
  - **macOS:** Xcode Command Line Tools.
  - **Linux:** `webkit2gtk`, `build-essential`, and related packages — see the
    [Tauri prerequisites guide](https://tauri.app/start/prerequisites/).

### Install dependencies

```bash
npm install
```

### Run the app in development

```bash
npm run dev          # launches Tauri; the Vite dev server runs on http://localhost:1420
```

To work on the UI in a normal browser (no Rust required):

```bash
npm run dev:web
```

### Type-check every package

```bash
npm run typecheck
```

### Production build

```bash
npm run build        # type-check + bundle the frontend
npm run build:tauri  # full Tauri desktop bundle (requires Rust + platform build tools)
```

---

## Current module

**Module 0 — Foundation (complete).**

What exists today:

- A buildable npm-workspace monorepo with one Tauri + React desktop app.
- Strict-TypeScript abstractions for providers, agents, tools, context, terminal, git and storage.
- A permission model (`SAFE` / `MODERATE` / `DANGEROUS`) with a real pre-execution interceptor.
- A provider registry and a metadata catalogue of the providers ForgeAI intends to support.
- A configuration service that never stores secrets, plus a credential-store abstraction
  intended to be backed by the OS keychain later.
- A desktop UI shell: activity bar, explorer, Monaco editor surface, chat panel, terminal
  panel, status bar and a settings panel for provider/model selection.

What deliberately does **not** exist yet (see the TODOs in code):

- No provider adapters (no network calls).
- No agent execution loop.
- No tool implementations.
- No command execution, no PTY.
- No real Git integration (HTTP calls to Git providers are also out of scope).
- No disk persistence and no OS keychain integration.

---

## Planned modules

| Module | Focus                                                                 |
| ------ | --------------------------------------------------------------------- |
| **0**  | **Foundation — structure, abstractions, security boundary (this module)** |
| 1     | Provider adapters + secure credential storage + streaming chat        |
| 2     | Real file system tooling (read/write/edit/list/search) behind permissions |
| 3     | Terminal + command execution with a permission-gated approval flow     |
| 4     | Git integration (status, diff, commit)                                 |
| 5     | Context engine (project understanding, indexing, retrieval)           |
| 6     | Agent loop (plan → act → observe → verify → report)                   |
| 7     | Autonomous task execution, checkpoints and rollback                   |

Modules are intentionally independent. A later module may be developed without touching the
UI because the UI already depends on abstractions, not implementations.

---

## Security philosophy

Security is a first-class design concern, not an afterthought.

1. **AI output is never trusted.** Model output is data, not authority. Nothing a model
   produces is executed without passing through the permission system.
2. **Deny by default.** Uncertain actions are escalated to the human, not silently allowed.
   `MODERATE` and `DANGEROUS` actions always require an explicit decision.
3. **Intercept before execution.** The permission check is a mandatory step *in front of*
   every tool, enforced in one place (`GuardedToolExecutor`) rather than scattered across tools.
4. **No unrestricted shell.** ForgeAI does not implement arbitrary shell execution. Commands
   will be modelled as requests that must be approved.
5. **Secrets are never stored in plain text.** API keys will live in the OS credential store
   (Windows Credential Manager, macOS Keychain, Secret Service). Configuration files hold
   references and preferences only.
6. **Smallest possible surface.** Tauri IPC exposes as little as possible; real capabilities
   are added one module at a time, each with its own permission review.

---

## License

MIT. See individual files for authorship notes.
