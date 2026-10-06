import type { WorkspaceAction } from "../features/workspace/workspace.slice";
import type { ExplorerAction } from "../features/explorer/explorer.slice";
import type { EditorAction } from "../features/editor/editor.slice";
import type { AssistantAction } from "../features/assistant/assistant.slice";
import type { LayoutAction } from "../features/panels/layout/layout.slice";
import type { NotificationsAction } from "../features/notifications/notifications.slice";
import type { DialogsAction } from "../features/dialogs/dialogs.slice";

/**
 * The store's action vocabulary.
 *
 * Each feature defines and owns its own actions; this module only unions them so one `dispatch`
 * can drive every slice. That is why slice reducers accept `IdeAction` rather than their own
 * narrow union — it keeps a single dispatch without casts. The import is type-only, so no runtime
 * dependency exists from a feature back to the app layer.
 */
export type IdeAction =
  | WorkspaceAction
  | ExplorerAction
  | EditorAction
  | AssistantAction
  | LayoutAction
  | NotificationsAction
  | DialogsAction;
