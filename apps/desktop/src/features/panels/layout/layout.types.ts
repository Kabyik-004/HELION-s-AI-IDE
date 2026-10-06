/** What the activity bar is showing. */
export type ActivityView = "explorer" | "search" | "source-control" | "settings";

/** Which tab the bottom panel is showing. */
export type BottomView = "terminal" | "problems";

/** Resizable panel sizes in pixels. */
export interface LayoutSizes {
  readonly sidebar: number;
  readonly ai: number;
  readonly bottom: number;
}

export type PanelKey = keyof LayoutSizes;

/** Drag limits, enforced in the reducer so no component has to re-check them. */
export const LAYOUT_LIMITS: Readonly<Record<PanelKey, { readonly min: number; readonly max: number }>> = {
  sidebar: { min: 180, max: 480 },
  ai: { min: 260, max: 560 },
  bottom: { min: 120, max: 520 },
};

/** The editor must keep at least this much room; used when fitting panels to the window. */
export const MIN_EDITOR_WIDTH = 280;
export const MIN_EDITOR_HEIGHT = 180;

export const DEFAULT_SIZES: LayoutSizes = { sidebar: 260, ai: 360, bottom: 200 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
