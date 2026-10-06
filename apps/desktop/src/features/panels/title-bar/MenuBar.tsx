import { useEffect, useRef, useState } from "react";

/**
 * A desktop-style application menu bar.
 *
 * Implemented from scratch rather than pulled in as a component library: it is a list of
 * buttons plus one absolutely-positioned dropdown, and owning it keeps the shell dependency
 * free. Every item carries a real action or is explicitly disabled with a reason.
 */

export interface MenuItem {
  readonly label: string;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** Tooltip shown while disabled, so the reason stays discoverable. */
  readonly reason?: string;
  /** Renders a check mark for toggling items (panel visibility, for example). */
  readonly checked?: boolean;
  readonly onSelect?: () => void;
}

export interface MenuDefinition {
  readonly label: string;
  readonly items: readonly MenuItem[];
}

export function MenuBar({ menus }: { readonly menus: readonly MenuDefinition[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openIndex === null) return;

    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setOpenIndex(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenIndex(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openIndex]);

  return (
    <div ref={containerRef} role="menubar" className="flex items-center gap-0.5">
      {menus.map((menu, index) => {
        const open = openIndex === index;
        return (
          <div key={menu.label} className="relative">
            <button
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpenIndex(open ? null : index)}
              // Once one menu is open, hovering another switches to it — standard desktop behaviour.
              onPointerEnter={() => setOpenIndex((current) => (current === null ? current : index))}
              className={[
                "rounded px-2 py-1 text-xs transition-colors",
                open ? "bg-ink-700 text-ink-100" : "text-ink-300 hover:bg-ink-750 hover:text-ink-100",
              ].join(" ")}
            >
              {menu.label}
            </button>

            {open && (
              <div
                role="menu"
                aria-label={menu.label}
                className="absolute left-0 top-full z-50 mt-1 min-w-60 overflow-hidden rounded border border-ink-650 bg-ink-800 py-1 shadow-xl shadow-black/50"
              >
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled ?? false}
                    title={item.disabled ? item.reason : undefined}
                    onClick={() => {
                      setOpenIndex(null);
                      item.onSelect?.();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-ink-200 transition-colors hover:bg-ink-700 disabled:cursor-not-allowed disabled:text-ink-500 disabled:hover:bg-transparent"
                  >
                    <span className="w-3 shrink-0 text-accent-400">{item.checked === true ? "✓" : ""}</span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.shortcut !== undefined && (
                      <span className="shrink-0 font-mono text-[10px] text-ink-400">{item.shortcut}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
