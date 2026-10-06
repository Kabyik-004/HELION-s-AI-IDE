import type { Workspace } from "../../infrastructure/filesystem/workspaceService";
import type { IdeAction } from "../../app/ideActions";

/**
 * The workspace feature's state.
 *
 * Deliberately tiny: which folder is open, and nothing else. The directory tree lives with the
 * explorer, open documents with the editor.
 */
export interface WorkspaceSliceState {
  readonly workspace: Workspace | null;
}

export function initialWorkspaceSlice(workspace: Workspace | null): WorkspaceSliceState {
  return { workspace };
}

export type WorkspaceAction =
  | { readonly type: "workspaceOpened"; readonly workspace: Workspace }
  | { readonly type: "workspaceClosed" };

export function reduceWorkspace(state: WorkspaceSliceState, action: IdeAction): WorkspaceSliceState {
  switch (action.type) {
    case "workspaceOpened": {
      const workspaceAction = action as WorkspaceAction & { readonly type: "workspaceOpened"; readonly workspace: Workspace };
      return { workspace: workspaceAction.workspace };
    }
    case "workspaceClosed":
      return { workspace: null };
    default:
      return state;
  }
}
