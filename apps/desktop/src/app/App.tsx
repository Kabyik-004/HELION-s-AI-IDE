import { useEffect } from "react";

import { AIChatPanel } from "../features/assistant/chat-panel/AIChatPanel";
import { DialogHost } from "../features/dialogs/DialogHost";
import { EditorArea } from "../features/editor/surface/EditorArea";
import { NotificationCenter } from "../features/notifications/NotificationCenter";
import { ActivityBar } from "../features/panels/activity-bar/ActivityBar";
import { BottomPanel } from "../features/panels/bottom-panel/BottomPanel";
import { LAYOUT_LIMITS } from "../features/panels/layout/layout.types";
import { ResizeHandle } from "../features/panels/layout/ResizeHandle";
import { SidePanel } from "../features/panels/side-panel/SidePanel";
import { StatusBar } from "../features/panels/status-bar/StatusBar";
import { TitleBar } from "../features/panels/title-bar/TitleBar";
import { AI_PANEL_MIN_VIEWPORT, SIDEBAR_MIN_VIEWPORT, useViewport } from "../shared/viewport/useViewport";
import { AppStateProvider } from "./AppStateProvider";
import { IdeProvider, useIde } from "./IdeProvider";

/**
 * ForgeAI's desktop shell.
 *
 * The layout is a resizable five-region arrangement:
 *
 *   TitleBar
 *   ┌ ActivityBar ┬ SidePanel ┬ Editor ┬ AI assistant ┐
 *   │             │           ├────────┴────────────────┤
 *   │             │           │ Panel (terminal/problems)│
 *   └─────────────┴───────────┴──────────────────────────┘
 *   StatusBar
 *
 * This component is layout only. Every behaviour belongs to a feature under `features/`; the shell
 * decides where things sit and which are visible.
 */
export default function App() {
  return (
    <AppStateProvider>
      <IdeProvider>
        <IdeShell />
      </IdeProvider>
    </AppStateProvider>
  );
}

function IdeShell() {
  const { state, api } = useIde();
  const { layout } = state;
  const viewport = useViewport();

  // Shrink panels that no longer fit, so a narrow window never pushes the editor off screen.
  useEffect(() => {
    api.panels.fitLayout(viewport.width, viewport.height);
  }, [api.panels, viewport.width, viewport.height]);

  useKeyboardShortcuts();

  // On narrow windows the panels collapse; the toggles stay visible so they can be brought back.
  const showSidebar = layout.sidebarVisible && viewport.width >= SIDEBAR_MIN_VIEWPORT;
  const showAi = layout.aiVisible && viewport.width >= AI_PANEL_MIN_VIEWPORT;
  const showBottom = layout.bottomVisible;

  return (
    <div className="flex h-full flex-col bg-ink-950 text-ink-200">
      <TitleBar />

      <div className="flex min-h-0 flex-1">
        <ActivityBar />

        {showSidebar && (
          <>
            <aside
              style={{ width: layout.sizes.sidebar }}
              className="flex shrink-0 flex-col overflow-hidden border-r border-ink-700/70 bg-ink-900"
            >
              <SidePanel />
            </aside>
            <ResizeHandle
              orientation="vertical"
              label="Resize side panel"
              value={layout.sizes.sidebar}
              min={LAYOUT_LIMITS.sidebar.min}
              max={LAYOUT_LIMITS.sidebar.max}
              onDrag={(movement) => api.panels.resizePanel("sidebar", layout.sizes.sidebar + movement)}
              onStep={(value) => api.panels.resizePanel("sidebar", value)}
            />
          </>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <EditorArea />
            </div>

            {showAi && (
              <>
                <ResizeHandle
                  orientation="vertical"
                  label="Resize AI assistant"
                  value={layout.sizes.ai}
                  min={LAYOUT_LIMITS.ai.min}
                  max={LAYOUT_LIMITS.ai.max}
                  // The assistant is on the right, so dragging right makes it narrower.
                  onDrag={(movement) => api.panels.resizePanel("ai", layout.sizes.ai - movement)}
                  onStep={(value) => api.panels.resizePanel("ai", value)}
                />
                <aside style={{ width: layout.sizes.ai }} className="shrink-0 overflow-hidden">
                  <AIChatPanel />
                </aside>
              </>
            )}
          </div>

          {showBottom && (
            <>
              <ResizeHandle
                orientation="horizontal"
                label="Resize panel"
                value={layout.sizes.bottom}
                min={LAYOUT_LIMITS.bottom.min}
                max={LAYOUT_LIMITS.bottom.max}
                // The panel sits below the divider, so dragging down makes it shorter.
                onDrag={(movement) => api.panels.resizePanel("bottom", layout.sizes.bottom - movement)}
                onStep={(value) => api.panels.resizePanel("bottom", value)}
              />
              <div style={{ height: layout.sizes.bottom }} className="shrink-0 overflow-hidden">
                <BottomPanel />
              </div>
            </>
          )}
        </div>
      </div>

      <StatusBar />

      {/* Global overlays: dialogs and notifications are state-driven, so they mount once. */}
      <DialogHost />
      <NotificationCenter />
    </div>
  );
}

/** Global keyboard shortcuts. Declared in one place so they are easy to audit. */
function useKeyboardShortcuts() {
  const { state, api } = useIde();
  const activeTabPath = state.editor.activeTabPath;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();

      if (key === "b" && !event.shiftKey) {
        event.preventDefault();
        api.panels.toggleSidebar();
      } else if (key === "j" && !event.shiftKey) {
        event.preventDefault();
        api.panels.toggleBottom();
      } else if (key === "a" && event.shiftKey) {
        event.preventDefault();
        api.panels.toggleAi();
      } else if (key === "o" && event.shiftKey) {
        event.preventDefault();
        api.panels.activateActivity("explorer");
      } else if (key === "s" && !event.shiftKey) {
        // Also stops the webview's own save dialog.
        event.preventDefault();
        if (activeTabPath !== null) void api.editor.saveFile(activeTabPath);
      } else if (key === "w" && !event.shiftKey) {
        event.preventDefault();
        if (activeTabPath !== null) void api.editor.requestClose(activeTabPath);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [api, activeTabPath]);
}
