export interface PromptDialogRequest {
  readonly kind: "prompt";
  readonly id: string;
  readonly title: string;
  readonly label: string;
  readonly initialValue: string;
  readonly confirmLabel: string;
  readonly placeholder?: string;
  /**
   * Names already present in the destination folder, checked inline so a clash is reported before
   * the round trip. The backend remains the authority and re-validates.
   */
  readonly taken?: readonly string[];
  /** Returns a validation error to display, or `undefined` when the value is acceptable. */
  readonly validate?: (value: string) => string | undefined;
  readonly resolve: (value: string | null) => void;
}

export interface ConfirmDialogRequest {
  readonly kind: "confirm";
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly detail?: string;
  readonly confirmLabel: string;
  readonly destructive: boolean;
  readonly resolve: (confirmed: boolean) => void;
}

export interface UnsavedDialogRequest {
  readonly kind: "unsaved";
  readonly id: string;
  readonly fileName: string;
  readonly resolve: (choice: "save" | "discard" | "cancel") => void;
}

/** A dialog awaiting an answer. */
export type DialogRequest = PromptDialogRequest | ConfirmDialogRequest | UnsavedDialogRequest;
