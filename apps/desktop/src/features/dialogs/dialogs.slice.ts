import type { DialogRequest } from "./dialogs.types";
import type { IdeAction } from "../../app/ideActions";

/**
 * The dialogs feature's state: at most one open question.
 *
 * The resolver is held in state so any feature can ask a question and `await` the answer without
 * prop drilling. Dialog requests are transient UI state and are never serialised.
 */
export interface DialogsSliceState {
  readonly dialog: DialogRequest | null;
}

export function initialDialogsSlice(): DialogsSliceState {
  return { dialog: null };
}

export type DialogsAction =
  | { readonly type: "dialogOpened"; readonly dialog: DialogRequest }
  | { readonly type: "dialogClosed" };

export function reduceDialogs(state: DialogsSliceState, action: IdeAction): DialogsSliceState {
  switch (action.type) {
    case "dialogOpened":
      return { dialog: action.dialog };
    case "dialogClosed":
      return { dialog: null };
    default:
      return state;
  }
}
