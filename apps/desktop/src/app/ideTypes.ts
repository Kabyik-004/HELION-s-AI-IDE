import type { Workspace } from "../infrastructure/filesystem/workspaceService";
import { initialExplorerSlice, type ExplorerSliceState } from "../features/explorer/explorer.slice";
import { initialEditorSlice, type EditorSliceState } from "../features/editor/editor.slice";
import { initialAssistantSlice, type AssistantSliceState } from "../features/assistant/assistant.slice";
import { initialLayoutSlice, type LayoutSliceState } from "../features/panels/layout/layout.slice";
import {
  initialNotificationsSlice,
  type NotificationsSliceState,
} from "../features/notifications/notifications.slice";
import { initialDialogsSlice, type DialogsSliceState } from "../features/dialogs/dialogs.slice";
import { initialWorkspaceSlice, type WorkspaceSliceState } from "../features/workspace/workspace.slice";

/**
 * The whole application state, composed of one slice per feature.
 *
 * Nothing here is feature logic; it is the shape of the store, assembled from the slices each
 * feature owns. Adding a feature means adding a slice and one line to this interface — not
 * extending a god object.
 */
export interface IdeState {
  readonly workspace: WorkspaceSliceState;
  readonly explorer: ExplorerSliceState;
  readonly editor: EditorSliceState;
  readonly assistant: AssistantSliceState;
  readonly layout: LayoutSliceState;
  readonly notifications: NotificationsSliceState;
  readonly dialogs: DialogsSliceState;
}

export function createInitialIdeState(workspace: Workspace | null): IdeState {
  return {
    workspace: initialWorkspaceSlice(workspace),
    explorer: initialExplorerSlice(),
    editor: initialEditorSlice(),
    assistant: initialAssistantSlice(),
    layout: initialLayoutSlice(),
    notifications: initialNotificationsSlice(),
    dialogs: initialDialogsSlice(),
  };
}
