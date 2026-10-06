# Tests

Tests for ForgeAI. The suite runs against a **real production build** served by Vite preview, so
results describe what actually ships rather than a development-only path.

## Running

```bash
npm run test:e2e
```

Playwright starts the web server itself: it rebuilds the frontend (`vite build`) and serves it on
`http://localhost:4173` before running. A fresh build every time means a green run cannot
describe stale output.

First-time setup on a new machine:

```bash
npx playwright install chromium
```

## What is covered today

**`shell.spec.ts` — the IDE shell (Module 1)**

| Test | Verifies |
| ---- | -------- |
| Shell layout | Every region renders (menubar, activity bar, explorer, editor, AI panel, bottom dock, status bar) and the console stays free of errors |
| Project tree | The example project lists, directories expand lazily, and a file opens into a selected tab with its real contents in the editor |
| Editing | Typing marks the file as having unsaved changes; the typed text is present exactly once (guards against a mis-controlled Monaco value duplicating input) |
| Bottom dock | Switching between Terminal and Problems shows the correct view |
| AI panel | A message can be composed and sent, and the panel says plainly that no provider is connected |
| Panel controls | `Ctrl+B` toggles the side panel; dragging the divider resizes it |
| Responsiveness | Panels collapse on narrow windows while their toggle buttons stay reachable |

**`workspace.spec.ts` — the real workspace (Module 2)**

| Test | Verifies |
| ---- | -------- |
| Nested navigation | Folders expand lazily, a second level is only read when opened, and collapsing hides children |
| Tabs | Several files stay open, re-selecting focuses the existing tab, closing picks a neighbour |
| Binary files | A non-text file shows a notice instead of loading into the editor |
| Create | A file is created and opened; a folder is created and appears |
| Validation | Invalid names and duplicate names are rejected inline, without a round trip |
| Rename | Renaming a file moves its open tab and keeps it clean and readable; renaming a folder keeps it expanded |
| Delete | Deletion always asks first; cancelling changes nothing; confirming removes it and closes its tab; folders warn about their contents |
| Unsaved changes | Closing a dirty file prompts, and Cancel / Don't Save / Save each behave correctly |
| Save | `Ctrl+S` clears the dirty marker, and no error is reported |

## Rust unit tests

Path confinement, name validation, binary detection and every file operation are tested against
a **real temporary directory**:

```bash
cd apps/desktop/src-tauri
cargo test
```

These are the tests that matter most for safety: traversal attempts, symlink escapes, reserved
names, and refusal to delete the workspace root are all asserted there, because they cannot be
expressed through the browser interface.

## Not covered here

The **Tauri window** is validated separately by launching the built executable
(`apps/desktop/src-tauri/target/release/forgeai.exe`) and confirming the process starts, creates
its window and stays alive.

The browser suite runs against `ExampleFileSystem` — the same `FileSystemPort` interface, a
different implementation — so it exercises the whole UI and state layer but not real disk I/O.
Real disk I/O is covered by the Rust unit tests.

## Planned

- Unit tests for the packages: permission policy, guarded tool executor, config service.
- Integration tests once provider adapters exist: provider + agent + tools together.
