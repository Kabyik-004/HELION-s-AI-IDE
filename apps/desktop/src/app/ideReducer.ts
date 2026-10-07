import { reduceWorkspace } from "../features/workspace/workspace.slice";
import { reduceExplorer } from "../features/explorer/explorer.slice";
import { reduceEditor } from "../features/editor/editor.slice";
import { reduceAssistant } from "../features/assistant/assistant.slice";
import { reduceLayout } from "../features/panels/layout/layout.slice";
import { reduceNotifications } from "../features/notifications/notifications.slice";
import { reduceDialogs } from "../features/dialogs/dialogs.slice";
import { reduceProviders } from "../features/providers/providers.slice";
import type { IdeAction } from "./ideActions";
import type { IdeState } from "./ideTypes";

/**
 * Composes the feature slices into one reducer.
 *
 * Every slice sees every action and ignores the ones it does not own, returning its previous
 * reference. That is what keeps a change in one feature from re-rendering another.
 *
 * Cross-feature events (`pathRenamed`, `pathRemoved`) are handled by both the explorer and the
 * editor slice, each fixing up data it owns. The operation that produced the event never reaches
 * into either.
 */
export function ideReducer(state: IdeState, action: IdeAction): IdeState {
  const next: IdeState = {
    workspace: reduceWorkspace(state.workspace, action),
    explorer: reduceExplorer(state.explorer, action),
    editor: reduceEditor(state.editor, action),
    assistant: reduceAssistant(state.assistant, action),
    layout: reduceLayout(state.layout, action),
    notifications: reduceNotifications(state.notifications, action),
    dialogs: reduceDialogs(state.dialogs, action),
    providers: reduceProviders(state.providers, action),
  };

  // Preserve the top-level reference when nothing changed, so unrelated re-renders are avoided.
  if (
    next.workspace === state.workspace &&
    next.explorer === state.explorer &&
    next.editor === state.editor &&
    next.assistant === state.assistant &&
    next.layout === state.layout &&
    next.notifications === state.notifications &&
    next.dialogs === state.dialogs &&
    next.providers === state.providers
  ) {
    return state;
  }
  return next;
}
