import Editor from "@monaco-editor/react";

import { useAppState } from "../state/app-state";

const WELCOME_DOCUMENT = `# ForgeAI

An AI-native desktop IDE. You are looking at **Module 0: Foundation**.

## What works right now

- The desktop shell boots (Tauri + React + TypeScript).
- Configuration is read and written through a \`ConfigService\`
  (see the live JSON in the Settings panel).
- The provider catalogue is populated from the provider abstraction.
- Tools have a contract and a permission-guarded executor.

## What is intentionally missing

- Provider adapters and chat          -> Module 1
- File system tools                   -> Module 2
- Terminal / command execution        -> Module 3
- Git integration                     -> Module 4
- Context engine providers            -> Module 5
- The agent loop                      -> Module 6

Nothing above is stubbed. There are no fake implementations that
pretend to work, because a foundation built on illusions is worse
than an honest gap.

## Architecture in one line

The UI depends on interfaces; concrete implementations are chosen in
exactly one place (apps/desktop/src/lib/services.ts).
`;

/**
 * The editor surface.
 *
 * Monaco is real and bundled locally, but there is no file system yet, so it shows a
 * read-only welcome document. Opening real files is Module 2 — the point of showing Monaco now
 * is to prove the editor integration works end to end.
 */
export function EditorPane() {
  const { config } = useAppState();

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950">
      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-2">
        <span className="rounded-t border-b border-amber-400 px-3 py-1.5 text-xs text-zinc-300">
          Welcome
        </span>
        <span className="ml-auto pr-1 text-[10px] text-zinc-600">
          {config.provider.selectedProviderId ?? "no provider"} ·{" "}
          {config.provider.selectedModelId ?? "no model"}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          theme="vs-dark"
          value={WELCOME_DOCUMENT}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            fontSize: 13,
            renderLineHighlight: "none",
            padding: { top: 12 },
          }}
        />
      </div>
    </div>
  );
}
