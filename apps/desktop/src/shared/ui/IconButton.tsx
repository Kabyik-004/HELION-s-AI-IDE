import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons must always be described for assistive technology. */
  readonly label: string;
  readonly children: ReactNode;
  /** Set for toggle buttons. Left undefined for plain action buttons. */
  readonly active?: boolean;
  readonly size?: "sm" | "md";
}

/**
 * A square, icon-only button.
 *
 * `title` doubles as the tooltip and `aria-label` carries the accessible name, so a control never
 * relies on its glyph alone. Passing `active` turns the button into a toggle (it then also
 * exposes `aria-pressed`); omitting it keeps it a plain button.
 */
export function IconButton({ label, children, active, size = "md", className = "", ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={[
        "inline-flex shrink-0 items-center justify-center rounded transition-colors",
        size === "sm" ? "h-6 w-6" : "h-7 w-7",
        active === true
          ? "bg-ink-700 text-accent-400"
          : "text-ink-300 hover:bg-ink-700/70 hover:text-ink-100",
        "disabled:cursor-not-allowed disabled:text-ink-500 disabled:hover:bg-transparent",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
