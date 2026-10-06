import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A right-click menu.
 *
 * Positioned at the pointer, flipped when it would overflow the window, and dismissed by Escape,
 * an outside click, or scroll. Items are plain data so the explorer can build them per node
 * without duplicating markup.
 */
export interface ContextMenuItem {
  readonly label: string;
  readonly icon?: ReactNode;
  readonly shortcut?: string;
  readonly disabled?: boolean;
  readonly reason?: string;
  /** Renders in the danger colour and is separated from the items above it. */
  readonly destructive?: boolean;
  readonly onSelect?: () => void;
}

export interface ContextMenuState {
  readonly x: number;
  readonly y: number;
  readonly items: readonly ContextMenuItem[];
}

export function ContextMenu({ menu, onClose }: { readonly menu: ContextMenuState; readonly onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: menu.x, y: menu.y });

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    const { width, height } = panel.getBoundingClientRect();
    const margin = 8;
    setPosition({
      x: Math.min(menu.x, window.innerWidth - width - margin),
      y: Math.min(menu.y, window.innerHeight - height - margin),
    });
  }, [menu]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (panelRef.current !== null && !panelRef.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onScroll = () => onClose();

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="menu"
      style={{ left: position.x, top: position.y }}
      className="fixed z-[120] min-w-52 overflow-hidden rounded border border-ink-650 bg-ink-800 py-1 shadow-xl shadow-black/50"
    >
      {menu.items.map((item, index) => (
        <div key={`${item.label}-${index}`}>
          {item.destructive === true && index > 0 && <div className="my-1 h-px bg-ink-700" />}
          <button
            type="button"
            role="menuitem"
            disabled={item.disabled ?? false}
            title={item.disabled === true ? item.reason : undefined}
            onClick={() => {
              onClose();
              item.onSelect?.();
            }}
            className={[
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors disabled:cursor-not-allowed disabled:text-ink-500 disabled:hover:bg-transparent",
              item.destructive === true
                ? "text-danger-500 hover:bg-danger-500/10"
                : "text-ink-200 hover:bg-ink-700",
            ].join(" ")}
          >
            {item.icon !== undefined && <span className="shrink-0 text-ink-400">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut !== undefined && (
              <span className="shrink-0 font-mono text-[10px] text-ink-400">{item.shortcut}</span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
