import { useEffect, useRef, useState } from "react";

import { useIde } from "../../app/IdeProvider";
import { Button } from "../../shared/ui/Button";
import { Dialog } from "../../shared/ui/Dialog";
import type { ConfirmDialogRequest, PromptDialogRequest, UnsavedDialogRequest } from "./dialogs.types";

/**
 * Renders whichever dialog the dialogs slice is currently asking for.
 *
 * Dialogs are state, not local component concerns: a menu item, a context menu or a keyboard
 * shortcut can all ask a question and `await` the answer. Mounting this once means every prompt in
 * the application looks and behaves the same.
 */
export function DialogHost() {
  const { state, api } = useIde();
  const dialog = state.dialogs.dialog;

  if (dialog === null) return null;

  switch (dialog.kind) {
    case "prompt":
      return <PromptDialog key={dialog.id} request={dialog} onAnswer={api.ui.answerPrompt} />;
    case "confirm":
      return <ConfirmDialog key={dialog.id} request={dialog} onAnswer={api.ui.answerConfirm} />;
    case "unsaved":
      return <UnsavedDialog key={dialog.id} request={dialog} onAnswer={api.ui.answerUnsaved} />;
    default:
      return null;
  }
}

/* ------------------------------------------------------------------------------- prompt -- */

function PromptDialog({
  request,
  onAnswer,
}: {
  readonly request: PromptDialogRequest;
  readonly onAnswer: (value: string | null) => void;
}) {
  const [value, setValue] = useState(request.initialValue);
  const [error, setError] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (input === null) return;
    input.focus();
    // Select the existing name so renaming is a single keystroke away.
    input.select();
  }, []);

  const submit = () => {
    const name = value.trim();
    const problem = request.validate?.(name);
    if (problem !== undefined) {
      setError(problem);
      return;
    }
    const taken = request.taken?.some(
      (existing) => existing.toLowerCase() === name.toLowerCase() && existing !== request.initialValue,
    );
    if (taken === true) {
      setError("Something with that name already exists here.");
      return;
    }
    onAnswer(name);
  };

  return (
    <Dialog title={request.title} onClose={() => onAnswer(null)}>
      <label htmlFor="forgeai-prompt-input" className="mb-1 block text-[11px] text-ink-400">
        {request.label}
      </label>
      <input
        id="forgeai-prompt-input"
        ref={inputRef}
        value={value}
        placeholder={request.placeholder}
        onChange={(event) => {
          setValue(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
        }}
        className={[
          "w-full rounded border bg-ink-950 px-2.5 py-2 font-mono text-xs text-ink-100 placeholder:text-ink-500 focus:outline-none",
          error === undefined ? "border-ink-650 focus:border-accent-600" : "border-danger-500",
        ].join(" ")}
      />
      {error !== undefined && <p className="mt-1.5 text-[11px] text-danger-500">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => onAnswer(null)}>Cancel</Button>
        <Button variant="primary" onClick={submit}>
          {request.confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------------ confirm -- */

function ConfirmDialog({
  request,
  onAnswer,
}: {
  readonly request: ConfirmDialogRequest;
  readonly onAnswer: (confirmed: boolean) => void;
}) {
  return (
    <Dialog title={request.title} onClose={() => onAnswer(false)}>
      <p className="text-ink-200">{request.message}</p>
      {request.detail !== undefined && <p className="mt-1.5 text-[11px] text-ink-500">{request.detail}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => onAnswer(false)}>Cancel</Button>
        <Button variant={request.destructive ? "danger" : "primary"} onClick={() => onAnswer(true)}>
          {request.confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------------------ unsaved -- */

function UnsavedDialog({
  request,
  onAnswer,
}: {
  readonly request: UnsavedDialogRequest;
  readonly onAnswer: (choice: "save" | "discard" | "cancel") => void;
}) {
  return (
    <Dialog title={`${request.fileName} has unsaved changes`} onClose={() => onAnswer("cancel")}>
      <p className="text-ink-200">
        Your edits to <span className="font-mono text-ink-100">{request.fileName}</span> have not been saved
        yet.
      </p>
      <p className="mt-1.5 text-[11px] text-ink-500">Closing the tab now would lose them.</p>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={() => onAnswer("cancel")}>Cancel</Button>
        <Button onClick={() => onAnswer("discard")}>Don&apos;t Save</Button>
        <Button variant="primary" onClick={() => onAnswer("save")}>
          Save
        </Button>
      </div>
    </Dialog>
  );
}
