import {
  DEFAULT_SIZES,
  LAYOUT_LIMITS,
  MIN_EDITOR_HEIGHT,
  MIN_EDITOR_WIDTH,
  clamp,
  type ActivityView,
  type BottomView,
  type LayoutSizes,
  type PanelKey,
} from "./layout.types";
import type { IdeAction } from "../../../app/ideActions";

/** Which panels are visible, what the activity bar shows, and how big each panel is. */
export interface LayoutSliceState {
  readonly activity: ActivityView;
  readonly sidebarVisible: boolean;
  readonly aiVisible: boolean;
  readonly bottomVisible: boolean;
  readonly bottomView: BottomView;
  readonly sizes: LayoutSizes;
}

export function initialLayoutSlice(): LayoutSliceState {
  return {
    activity: "explorer",
    sidebarVisible: true,
    aiVisible: true,
    bottomVisible: true,
    bottomView: "terminal",
    sizes: DEFAULT_SIZES,
  };
}

export type LayoutAction =
  | { readonly type: "activityChanged"; readonly activity: ActivityView }
  | { readonly type: "sidebarVisibilityChanged"; readonly visible: boolean }
  | { readonly type: "aiVisibilityChanged"; readonly visible: boolean }
  | { readonly type: "bottomVisibilityChanged"; readonly visible: boolean }
  | { readonly type: "bottomViewChanged"; readonly view: BottomView }
  | { readonly type: "panelResized"; readonly panel: PanelKey; readonly value: number }
  | { readonly type: "layoutReset" }
  | { readonly type: "layoutFit"; readonly width: number; readonly height: number };

export function reduceLayout(state: LayoutSliceState, action: IdeAction): LayoutSliceState {
  switch (action.type) {
    case "activityChanged":
      return { ...state, activity: action.activity, sidebarVisible: true };

    case "sidebarVisibilityChanged":
      return { ...state, sidebarVisible: action.visible };

    case "aiVisibilityChanged":
      return { ...state, aiVisible: action.visible };

    case "bottomVisibilityChanged":
      return { ...state, bottomVisible: action.visible };

    case "bottomViewChanged":
      return { ...state, bottomView: action.view, bottomVisible: true };

    case "panelResized": {
      const limits = LAYOUT_LIMITS[action.panel];
      return {
        ...state,
        sizes: { ...state.sizes, [action.panel]: clamp(action.value, limits.min, limits.max) },
      };
    }

    case "layoutReset":
      return { ...state, sizes: DEFAULT_SIZES };

    case "layoutFit": {
      // Shrink panels that no longer fit, so a narrow window never pushes the editor off screen.
      const sidebar = state.sidebarVisible
        ? clamp(
            state.sizes.sidebar,
            LAYOUT_LIMITS.sidebar.min,
            Math.max(
              LAYOUT_LIMITS.sidebar.min,
              action.width - MIN_EDITOR_WIDTH - (state.aiVisible ? state.sizes.ai : 0) - 96,
            ),
          )
        : state.sizes.sidebar;
      const ai = state.aiVisible
        ? clamp(
            state.sizes.ai,
            LAYOUT_LIMITS.ai.min,
            Math.max(
              LAYOUT_LIMITS.ai.min,
              action.width - MIN_EDITOR_WIDTH - (state.sidebarVisible ? sidebar : 0) - 96,
            ),
          )
        : state.sizes.ai;
      const bottom = state.bottomVisible
        ? clamp(
            state.sizes.bottom,
            LAYOUT_LIMITS.bottom.min,
            Math.max(LAYOUT_LIMITS.bottom.min, action.height - MIN_EDITOR_HEIGHT),
          )
        : state.sizes.bottom;
      if (sidebar === state.sizes.sidebar && ai === state.sizes.ai && bottom === state.sizes.bottom) {
        return state;
      }
      return { ...state, sizes: { sidebar, ai, bottom } };
    }

    default:
      return state;
  }
}
