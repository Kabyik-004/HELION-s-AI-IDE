import { newId } from "@forgeai/shared";

import type {
  ConfirmDialogRequest,
  DialogRequest,
  PromptDialogRequest,
  UnsavedDialogRequest,
} from "./dialogs.types";

/**
 * The public interface other features use to ask a question.
 *
 * Features `await` an answer instead of touching dialog state; the `DialogHost` component is the
 * only thing that renders it. That is what lets a file operation read as straightforward linear
 * code.
 */
export interface DialogService {
  prompt(options: Omit<PromptDialogRequest, "kind" | "id" | "resolve">): Promise<string | null>;
  confirm(options: Omit<ConfirmDialogRequest, "kind" | "id" | "resolve">): Promise<boolean>;
  confirmUnsaved(fileName: string): Promise<"save" | "discard" | "cancel">;
}

export function createDialogService(dispatch: (action: { type: "dialogOpened"; dialog: DialogRequest }) => void): DialogService {
  return {
    prompt(options) {
      return new Promise<string | null>((resolve) => {
        dispatch({ type: "dialogOpened", dialog: { kind: "prompt", id: newId("dlg"), resolve, ...options } });
      });
    },
    confirm(options) {
      return new Promise<boolean>((resolve) => {
        dispatch({ type: "dialogOpened", dialog: { kind: "confirm", id: newId("dlg"), resolve, ...options } });
      });
    },
    confirmUnsaved(fileName) {
      return new Promise<"save" | "discard" | "cancel">((resolve) => {
        const dialog: UnsavedDialogRequest = { kind: "unsaved", id: newId("dlg"), fileName, resolve };
        dispatch({ type: "dialogOpened", dialog });
      });
    },
  };
}
