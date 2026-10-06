import { ActivityBar } from "./components/ActivityBar";
import { ChatPanel } from "./components/ChatPanel";
import { EditorPane } from "./components/EditorPane";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { AppStateProvider } from "./state/app-state";

/**
 * The desktop layout: activity bar, side panel, editor + terminal, chat, status bar.
 *
 * `App` contains layout only. All behaviour lives behind the abstractions in `packages/`, which
 * is what lets the whole UI be replaced without touching the agent, providers, tools or security.
 */
export default function App() {
  return (
    <AppStateProvider>
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-200">
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <EditorPane />
            </div>
            <TerminalPanel />
          </main>
          <ChatPanel />
        </div>
        <StatusBar />
      </div>
    </AppStateProvider>
  );
}
