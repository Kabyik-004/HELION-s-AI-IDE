import {
  useCallback,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * A draggable divider between two panels.
 *
 * ForgeAI ships its own tiny resize primitive instead of depending on a layout library: the
 * behaviour is a few lines, it is keyboard accessible, and it keeps the dependency count at
 * zero. Panels clamp their own sizes (see `LAYOUT_LIMITS`), so this component only reports
 * movement and never has to know about minimums — except for keyboard steps.
 */
export interface ResizeHandleProps {
  /** `vertical` is a bar that resizes width; `horizontal` resizes height. */
  readonly orientation: "vertical" | "horizontal";
  /**
   * Called with the pixel movement since the previous event.
   * The parent adds or subtracts it, because dragging right grows a left panel but shrinks a
   * right-hand one.
   */
  readonly onDrag: (movement: number) => void;
  /** Current panel size, used as the starting point for keyboard resizing. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onStep: (value: number) => void;
  readonly label: string;
}

const KEYBOARD_STEP = 16;

export function ResizeHandle({ orientation, onDrag, value, min, max, onStep, label }: ResizeHandleProps) {
  const lastRef = useRef(0);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore secondary buttons so a right-click never starts a resize.
      if (event.button !== 0) return;
      event.preventDefault();
      lastRef.current = orientation === "vertical" ? event.clientX : event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      // Suppress text selection in the panels while dragging.
      document.body.style.userSelect = "none";
      setDragging(true);
    },
    [orientation],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const current = orientation === "vertical" ? event.clientX : event.clientY;
      const movement = current - lastRef.current;
      lastRef.current = current;
      if (movement !== 0) onDrag(movement);
    },
    [dragging, onDrag, orientation],
  );

  const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    document.body.style.userSelect = "";
    setDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const decrease = orientation === "vertical" ? "ArrowLeft" : "ArrowUp";
      const increase = orientation === "vertical" ? "ArrowRight" : "ArrowDown";
      if (event.key === decrease) {
        event.preventDefault();
        onStep(value - KEYBOARD_STEP);
      } else if (event.key === increase) {
        event.preventDefault();
        onStep(value + KEYBOARD_STEP);
      }
    },
    [onStep, orientation, value],
  );

  const isVertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isVertical ? "vertical" : "horizontal"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className={[
        "group relative z-20 shrink-0 select-none",
        isVertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
        // A wider invisible hit area than the 1px line, so it is easy to grab.
        "before:absolute before:content-['']",
        isVertical ? "before:-inset-x-1 before:inset-y-0" : "before:-inset-y-1 before:inset-x-0",
        "transition-colors",
        dragging ? "bg-accent-500" : "bg-ink-700 hover:bg-accent-600",
      ].join(" ")}
    />
  );
}
