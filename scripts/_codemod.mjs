// Temporary: relocates the desktop app into features/ + infrastructure/ + shared/ and rewrites
// every import specifier so nothing breaks. Feature logics and slices are written by hand after.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("apps/desktop/src");

/** [from, to], both relative to SRC. */
const MOVES = [
  // --- shared/ui -------------------------------------------------------------------------
  ["components/common/Button.tsx", "shared/ui/Button.tsx"],
  ["components/common/IconButton.tsx", "shared/ui/IconButton.tsx"],
  ["components/common/PanelHeader.tsx", "shared/ui/PanelHeader.tsx"],
  ["components/common/EmptyState.tsx", "shared/ui/EmptyState.tsx"],
  ["components/common/ContextMenu.tsx", "shared/ui/ContextMenu.tsx"],
  ["components/layout/Dialog.tsx", "shared/ui/Dialog.tsx"],
  ["components/icons/Icons.tsx", "shared/ui/Icons.tsx"],
  // --- shared (misc) ---------------------------------------------------------------------
  ["lib/format.ts", "shared/format/format.ts"],
  ["lib/use-viewport.ts", "shared/viewport/useViewport.ts"],
  ["types/chat.ts", "shared/types/chat.ts"],
  ["types/problem.ts", "shared/types/problem.ts"],
  // --- infrastructure --------------------------------------------------------------------
  ["lib/tauri-backend.ts", "infrastructure/ipc/backend.ts"],
  ["lib/is-tauri.ts", "infrastructure/ipc/isTauri.ts"],
  ["lib/tauri-fs.ts", "infrastructure/filesystem/tauriFileSystem.ts"],
  ["lib/example-file-system.ts", "infrastructure/filesystem/exampleFileSystem.ts"],
  ["lib/workspace-service.ts", "infrastructure/filesystem/workspaceService.ts"],
  ["lib/tauri-key-value-store.ts", "infrastructure/storage/tauriKeyValueStore.ts"],
  ["lib/monaco-setup.ts", "infrastructure/editor/monacoSetup.ts"],
  ["lib/services.ts", "app/composition.ts"],
  ["lib/language.ts", "shared/language/language.ts"],
  // --- features: panels ------------------------------------------------------------------
  ["components/layout/ResizeHandle.tsx", "features/panels/layout/ResizeHandle.tsx"],
  ["components/layout/MenuBar.tsx", "features/panels/title-bar/MenuBar.tsx"],
  ["components/layout/TitleBar.tsx", "features/panels/title-bar/TitleBar.tsx"],
  ["components/layout/ActivityBar.tsx", "features/panels/activity-bar/ActivityBar.tsx"],
  ["components/layout/Sidebar.tsx", "features/panels/side-panel/SidePanel.tsx"],
  ["components/layout/StatusBar.tsx", "features/panels/status-bar/StatusBar.tsx"],
  ["components/bottom/BottomPanel.tsx", "features/panels/bottom-panel/BottomPanel.tsx"],
  ["components/bottom/TerminalView.tsx", "features/panels/bottom-panel/TerminalView.tsx"],
  ["components/bottom/ProblemsView.tsx", "features/panels/bottom-panel/ProblemsView.tsx"],
  // --- features: explorer ----------------------------------------------------------------
  ["components/explorer/FileTree.tsx", "features/explorer/directory-tree/FileTree.tsx"],
  ["components/explorer/FileTreeNode.tsx", "features/explorer/directory-tree/FileTreeNode.tsx"],
  ["components/explorer/ExplorerPanel.tsx", "features/explorer/explorer-panel/ExplorerPanel.tsx"],
  // --- features: editor ------------------------------------------------------------------
  ["components/editor/CodeEditor.tsx", "features/editor/surface/CodeEditor.tsx"],
  ["components/editor/EditorArea.tsx", "features/editor/surface/EditorArea.tsx"],
  ["components/editor/EditorTabs.tsx", "features/editor/tabs/EditorTabs.tsx"],
  ["components/editor/WelcomeView.tsx", "features/editor/welcome/WelcomeView.tsx"],
  // --- features: assistant ---------------------------------------------------------------
  ["components/ai/AIChatPanel.tsx", "features/assistant/chat-panel/AIChatPanel.tsx"],
  ["components/ai/ChatComposer.tsx", "features/assistant/chat-panel/ChatComposer.tsx"],
  ["components/ai/ChatMessageItem.tsx", "features/assistant/chat-panel/ChatMessageItem.tsx"],
  // --- features: dialogs / notifications / settings ---------------------------------------
  ["components/dialogs/DialogHost.tsx", "features/dialogs/DialogHost.tsx"],
  ["components/common/NotificationCenter.tsx", "features/notifications/NotificationCenter.tsx"],
  ["components/settings/SettingsPanel.tsx", "features/settings/SettingsPanel.tsx"],
  // --- app --------------------------------------------------------------------------------
  ["App.tsx", "app/App.tsx"],
  ["state/app-state.tsx", "app/AppStateProvider.tsx"],
];

const abs = (rel) => path.resolve(SRC, rel);
const map = new Map();

for (const [from, to] of MOVES) {
  const source = abs(from);
  const target = abs(to);
  if (!fs.existsSync(source)) {
    console.log(`SKIP (missing): ${from}`);
    continue;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.renameSync(source, target);
  map.set(source, target);
}

// Also map the files that are split by hand, so imports pointing at them get rewritten to the
// new feature location (the split files themselves are written afterwards).
map.set(abs("state/ide-state.tsx"), abs("app/IdeProvider.tsx"));
map.set(abs("state/ide-reducer.ts"), abs("app/ideReducer.ts"));
map.set(abs("state/ide-types.ts"), abs("app/ideTypes.ts"));
map.set(abs("lib/file-name.ts"), abs("features/file-management/shared/nameValidation.ts"));

function listFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const CANDIDATES = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")];

function resolveSpecifier(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of CANDIDATES(base)) {
    if (fs.existsSync(candidate) && map.has(candidate)) return map.get(candidate);
  }
  return null;
}

let rewrites = 0;
for (const file of listFiles(SRC)) {
  const original = fs.readFileSync(file, "utf8");
  let text = original;

  // Static imports/exports: `from "./x"` and bare `import "./x"`.
  text = text.replace(/(from\s+["'])([^"']+)(["'])/g, (whole, pre, spec, post) => {
    if (!spec.startsWith(".")) return whole;
    const target = resolveSpecifier(file, spec);
    if (target === null) return whole;
    let next = path.relative(path.dirname(file), target).replace(/\\/g, "/");
    if (!next.startsWith(".")) next = `./${next}`;
    if (next !== spec) rewrites += 1;
    return `${pre}${next}${post}`;
  });

  text = text.replace(/(^|\n)(\s*import\s+)(["'])([^"']+)(["'];?)/g, (whole, lead, pre, q, spec, post) => {
    if (!spec.startsWith(".")) return whole;
    const target = resolveSpecifier(file, spec);
    if (target === null) return whole;
    let next = path.relative(path.dirname(file), target).replace(/\\/g, "/");
    if (!next.startsWith(".")) next = `./${next}`;
    if (next !== spec) rewrites += 1;
    return `${lead}${pre}${q}${next}${post}`;
  });

  if (text !== original) fs.writeFileSync(file, text);
}

// Remove directories that are now empty.
function prune(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) prune(path.join(dir, entry.name));
  }
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}
for (const dir of ["components", "lib", "state", "types"]) prune(path.join(SRC, dir));

console.log(`moved ${map.size} files, rewrote ${rewrites} import specifiers`);
