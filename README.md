# ForgeAI

**ForgeAI is an AI-native desktop IDE.** It is built around a simple idea: a developer
should be able to hand an AI a real development task, and the AI should be able to
understand the project, plan the work, change the code, run tools, verify the result and
report back — while the developer stays in control of what the AI is allowed to do.

ForgeAI is **not** a fork of, or a clone of, any existing IDE or agent. Its architecture is
designed from first principles so that each major subsystem (UI, providers, agent, tools,
context, terminal, git, storage, security) can be replaced independently.

> **Status: Module 3 — AI Provider & API Key System (complete).**
> Module 0 established the foundation, Module 1 built the desktop shell, Module 2 turned it into a
> real workspace, and Module 3 adds provider configuration, OS-keychain API keys and connection
> testing. Chat and streaming are **not** connected yet — that is Module 4. Nothing is faked; see
> *Current module*.

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

---

## The interface

```
┌──────────────────────────────────────────────────────────────────┐
│ ForgeAI   Project  File  View  Terminal  Help        ▤ ▥ ▦ ⚙     │  TitleBar
├──────────┬───────────────────────────────┬───────────────────────┤
│ forgeai  │  App.tsx •  Button.tsx  ×     │ AI assistant          │
│ ▾ src    │ ┌───────────────────────────┐ │ ● no provider         │
│  ▾ comp  │ │ 1  import { Button } …    │ │                       │
│   Bu…tsx │ │ 2  import { Header } …    │ │ 🤖 I can help you …   │
│   He…tsx │ │ 3                         │ │                       │
│  App.tsx │ └───────────────────────────┘ │ [ Ask ForgeAI… ]      │
│  main    │                               │ [Send] [Stop]         │
├──────────┴───────────────────────────────┴───────────────────────┤
│ Terminal │ Problems                                              │  BottomPanel
├──────────────────────────────────────────────────────────────────┤
│ forgeai-demo   no repository   Ln 1, Col 1        v0.1.0         │  StatusBar
└──────────────────────────────────────────────────────────────────┘
```

Every region is independently resizable by dragging the dividers, and the layout can be reset
from **View → Reset layout**. Right-click anywhere in the explorer for file operations.

---

## Architecture overview

ForgeAI is an **npm workspace monorepo**. There is one desktop application and a set of
independent packages. Packages depend on **interfaces**, never on each other's internals.

```
apps/desktop              The Tauri + React application
  src/
    components/
      layout/             TitleBar, ActivityBar, Sidebar, StatusBar, ResizeHandle, MenuBar, Dialog
      explorer/           FileTree + FileTreeNode + ExplorerPanel (real file system)
      editor/             EditorArea, EditorTabs, CodeEditor (Monaco), WelcomeView
      ai/                 AIChatPanel, ChatComposer, ChatMessageItem
      bottom/             BottomPanel, TerminalView, ProblemsView
      settings/           SettingsPanel
      dialogs/            DialogHost (prompt / confirm / unsaved)
      common/             Button, IconButton, PanelHeader, EmptyState, ContextMenu, NotificationCenter
      icons/              Inline SVG icon set (no dependency)
    state/
      app-state.tsx       Services + user configuration (including recent folders)
      ide-state.tsx       IDE view state + every file operation
      ide-reducer.ts      Pure state transitions
      ide-types.ts        State, buffer, dialog and notification types
    lib/
      services.ts         Composition root — the only place implementations are chosen
      workspace-service.ts Owns which folder is open and hands out the FileSystemPort
      tauri-backend.ts    The only module that speaks Tauri IPC
      tauri-fs.ts         FileSystemPort over the backend (absolute ⇄ workspace-relative)
      tauri-key-value-store.ts  Preferences persisted to the app config directory
      example-file-system.ts    In-memory project for the browser preview and tests
    types/                View-only types (chat, problems)
  src-tauri/
    src/
      lib.rs              Tauri builder + command registration
      workspace.rs        Workspace-confined file system (with unit tests)
      app_state.rs        Preference persistence (single JSON file)
    capabilities/         Least-privilege permission set
packages/
  shared                  Primitives + capability ports (FileSystemPort, CommandRunnerPort, …)
  security                Permission levels, policy, the pre-execution interceptor
  tools                   Tool contract, registry, permission-guarded executor
  providers               Provider abstraction + metadata catalogue
  agent                   Agent / message / task / event abstractions
  context                 Project-context abstraction
  git                     Git service abstraction
  terminal                Terminal + command-runner abstractions
  storage                 Config + credential storage abstractions
```

### The rule that keeps it modular

The UI never talks to a provider SDK, a shell, or the file system directly. It talks to
**abstractions**. The explorer and editor read files through `FileSystemPort`, so Module 2 was
able to swap the in-memory example project for real disk access with **no component changes** —
only the composition root and a new implementation.

### UI state

There is no state-management library. Two React contexts cover the whole shell:

| Context | Owns | Persisted? |
| ------- | ---- | ---------- |
| `AppStateProvider` | Services and user configuration (provider, model, agent settings, recent folders) | Yes, on the desktop |
| `IdeStateProvider` | View state: open tabs, buffers, active panel, panel visibility, layout sizes, cursor, problems, dialogs, notifications | No — view state |

They are deliberately separate: a settings change does not re-render the shell, and closing a
panel can never trigger a configuration write. `IdeStateProvider` is a reducer (`ide-reducer.ts`)
plus a memoised action object, and it is the **only** code that touches `FileSystemPort`, so every
file operation funnels through one reviewable place.

### Security boundary

Every tool carries a `PermissionLevel` (`SAFE`, `MODERATE`, `DANGEROUS`). The
`GuardedToolExecutor` in `@forgeai/tools` calls the `PermissionInterceptor` from
`@forgeai/security` **before** a tool body runs, and refuses to run it unless the decision is
`allow`. There is **no unrestricted shell execution** anywhere in the codebase — the terminal
package defines interfaces only, and the terminal view says so rather than pretending.

The file system has its own boundary, since it is the first capability that can change a user's
data. The renderer never sends an absolute path: every file command takes a
**workspace-relative** path, and the Rust backend rejects anything that is absolute, contains a
`..` component, or resolves outside the open folder after canonicalisation (which also stops a
symlink from pointing out of the workspace). See
[`docs/architecture.md § 11`](docs/architecture.md) for the full model.

---

## Technology stack

| Concern          | Choice                                  | Notes                                              |
| ---------------- | --------------------------------------- | -------------------------------------------------- |
| Desktop shell    | [Tauri 2](https://tauri.app)            | Rust backend, small binaries, native OS integration |
| UI               | [React 19](https://react.dev)           | Frontend only; no AI logic in components           |
| Language         | TypeScript (strict)                     | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` |
| Styling          | [Tailwind CSS 4](https://tailwindcss.com) | Design tokens in `@theme`; no runtime CSS-in-JS   |
| Editor           | [Monaco Editor](https://microsoft.github.io/monaco-editor/) | Bundled locally, custom `forgeai-dark` theme |
| Build tool       | [Vite](https://vite.dev)                | Fast dev server + production bundler               |
| Package manager  | npm workspaces                          | No external monorepo tool required                 |
| Tests            | [Playwright](https://playwright.dev)    | End-to-end shell tests against a production build  |

---

## Directory structure

```
forgeai/
├── apps/
│   └── desktop/
│       ├── src/                 # React application
│       └── src-tauri/           # Rust/Tauri shell
├── packages/                    # 9 independently replaceable modules
├── docs/
│   └── architecture.md
├── tests/
│   └── e2e/                     # Playwright shell tests
├── scripts/
├── playwright.config.ts
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

### Build

```bash
npm run build        # type-check + bundle the frontend
npm run build:tauri  # full Tauri desktop bundle (requires Rust + platform build tools)
```

### Test

```bash
npm run test:e2e     # builds the frontend, serves it, and drives it in a real browser
```

The end-to-end suite covers the shell **and** the workspace: every panel renders, folders expand
lazily, files open into tabs, edits are marked and saved, files and folders can be created,
renamed and deleted (with confirmation), closing a dirty file prompts, and the console stays
free of errors throughout.

The path-confinement rules are covered separately by unit tests over a real temporary directory:

```bash
cd apps/desktop/src-tauri && cargo test
```

### Windows on ARM (ARM64)

Most platforms build with the default toolchain. On **Windows on ARM**, one extra step may be
needed. The ARM64 MSVC linker (`Hostarm64\arm64\link.exe`) ships in the optional
**"MSVC v143 — VS 2022 C++ ARM64 build tools"** component, which the default *Desktop
development with C++* workload does **not** install. If `cargo` fails with
`linker 'link.exe' not found`, either add that component in the Visual Studio Installer, or use
the x86_64 toolchain — it links with the x64 toolset and runs under Windows' x64 emulation:

```bash
rustup toolchain install stable-x86_64-pc-windows-msvc --force-non-host
RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-msvc npm run tauri:build
```

This produces an x64 application that runs on ARM64 Windows via emulation. It is identical in
behaviour to a native ARM64 build for ForgeAI's purposes.

---

## Current module

**Module 3 — AI Provider & API Key System (complete).**

Open *Settings → Providers* to configure providers, store API keys securely and test connectivity:

- **Multiple instances per provider** — "OpenAI Personal" and "OpenAI Work" can coexist, each with
  its own endpoint, model and key.
- **Keys never live in configuration.** They are written to the OS credential store through narrow
  Rust commands; configuration holds only ids, names, endpoints, models and enabled flags.
- **Keys are never displayed.** The UI knows only whether a key is stored, and the masked input is
  cleared the moment it is saved.
- **Enable, disable, activate, edit and delete** a provider. Deleting removes its key with it, so no
  orphan secret is left behind.
- **Connection testing** probes the real endpoint and reports, honestly, a success, a rejected key,
  a rate limit or an unreachable host — never the key.
- **Validation** runs in the form and again in the service; the service never trusts the UI.

Provider chat, streaming and model listing are **not** implemented — those arrive in Module 4. The
registry is populated with real OpenAI-compatible factories so Module 4 can build on it.

The Module 2 workspace continues to work unchanged. What works today:

- **Open any local folder** through the native picker (*Project → Open Folder…*). The chosen
  folder becomes the workspace, its contents are scanned, and recent folders are remembered
  across restarts.
- **Real directory browsing**: lazy expansion (only what you open is read), folders-first
  ordering, dot-file toggle, a truncation notice for enormous directories, and per-directory
  refresh.
- **Real file editing**: Monaco with language detection by extension, tabs that follow renames,
  per-file undo history, `Ctrl+S`, Save All, and a **binary / too-large notice** instead of
  loading junk into the editor.
- **File operations** from the explorer toolbar, context menu and File menu: create file, create
  folder, rename, and delete — the last two guarded by confirmation, with renames moving open
  tabs and buffers with them.
- **Unsaved-changes protection**: a dirty marker per tab, a Save / Don't Save / Cancel prompt
  before closing, and a warning if the file changed on disk underneath you.
- **Graceful errors**: failures are translated into readable messages ("That file or folder no
  longer exists.") with the technical detail available behind a *Details* toggle.
- **Preferences persisted** to the application config directory on the desktop.
- **22 end-to-end tests** (shell + workspace) and **13 Rust unit tests** over real temporary
  directories, all passing.

What deliberately does **not** exist yet (see the TODOs in code):

- No AI chat, streaming or model listing. Providers can be configured and tested, but replies
  arrive in **Module 4**.
- No command execution and no PTY. The terminal view states this explicitly; a later module.
- No git integration and no tool implementations; a later module.
- No context engine providers, no agent loop.
- File watching is not implemented: external changes are detected when the window regains focus
  (using file modification times), not continuously. See *Known limitations* in the Module 2
  report.

### How the file system is wired

```
React component
   │  calls an action (openFile, saveFile, createFile, renameEntry, deleteEntry)
   ▼
IdeStateProvider            ← the only place that touches FileSystemPort
   │  absolute path
   ▼
FileSystemPort              ← the abstraction (packages/shared)
   │
   ├── TauriFileSystem       desktop: converts to a workspace-relative path, then invoke()
   │        │
   │        ▼  tauri-backend.ts (the only module that speaks IPC)
   │     Rust workspace.rs   ← rejects traversal, confines to the open folder, hits the OS
   │
   └── ExampleFileSystem     browser preview and end-to-end tests (in-memory example project)
```

---

## Planned modules

| Module | Focus                                                                 |
| ------ | --------------------------------------------------------------------- |
| 0      | Foundation — structure, abstractions, security boundary               |
| 1      | IDE Shell — layout, panels, theme, editor, explorer UI, AI panel UI    |
| 2      | Real Project Workspace — open a folder, real file system, file operations, save/edit  |
| **3**  | **AI Provider & API Key System — provider configuration, OS-keychain credentials, connection testing (this module)** |
| 4      | AI Chat & Streaming — chat UI, streaming replies, model listing                        |
| 5+     | Terminal (PTY, permission-gated commands), Git, tools, context engine, agent loop, autonomous tasks |

Modules are intentionally independent. A later module may be developed without touching the UI,
because the UI already depends on abstractions rather than implementations.

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
   will be modelled as requests that must be approved. The terminal view reflects this.
5. **Secrets are never stored in plain text.** API keys live in the OS credential store
   (Windows Credential Manager, macOS Keychain, Secret Service) under `provider:<id>:apiKey`.
   Configuration files hold preferences only — never a key, and a key never appears in a log or in
   an error message.
6. **Smallest possible surface.** Tauri IPC exposes as little as possible. Real capabilities are
   added one module at a time. Module 2 added exactly one plugin permission — `dialog:allow-open`,
   the native folder picker — and no general-purpose file plugin. Module 3 added no plugin
   permission at all: credential storage is four app-level commands that read and write the OS
   keychain and nothing else.

---

## License

MIT. See individual files for authorship notes.
