import { useEffect, type ReactNode } from "react";

import { IconButton } from "./IconButton";
import { CloseIcon } from "./Icons";

/** A minimal modal dialog. Closes on Escape or on a click outside its panel. */
export interface DialogProps {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function Dialog({ title, onClose, children }: DialogProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6"
      onPointerDown={(event) => {
        // Only a click on the backdrop dismisses; clicks inside must not bubble out.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md overflow-hidden rounded border border-ink-650 bg-ink-850 shadow-2xl shadow-black/60"
      >
        <header className="flex items-center justify-between border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-200">{title}</h2>
          <IconButton label="Close dialog" size="sm" onClick={onClose}>
            <CloseIcon size={14} />
          </IconButton>
        </header>
        <div className="px-4 py-3 text-xs leading-relaxed text-ink-300">{children}</div>
      </div>
    </div>
  );
}
