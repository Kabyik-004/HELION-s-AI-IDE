import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: ButtonVariant;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent-600 text-ink-950 hover:bg-accent-500",
  secondary: "border border-ink-650 text-ink-200 hover:bg-ink-750",
  danger: "bg-danger-500 text-ink-950 hover:bg-danger-500/90",
  ghost: "text-ink-300 hover:bg-ink-750 hover:text-ink-100",
};

/** A small button used by dialogs and panel toolbars. */
export function Button({ children, variant = "secondary", className = "", ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={[
        "inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
