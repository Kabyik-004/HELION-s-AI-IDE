import type { FeatureDeps } from "../../app/featureContext";
import type { ActivityView, BottomView, PanelKey } from "./layout/layout.types";

/**
 * The shell's panel commands: which view is showing, what is visible, and how big things are.
 *
 * Trivial single transitions, grouped because they are one concern — the window layout. Sizing
 * limits are enforced by the layout slice, so nothing here re-checks them.
 */
export interface PanelActions {
  setActivity(activity: ActivityView): void;
  /** Selecting the current activity again collapses the panel, like most editors. */
  activateActivity(activity: ActivityView): void;
  toggleSidebar(): void;
  toggleAi(): void;
  toggleBottom(): void;
  toggleBottomView(view: BottomView): void;
  resizePanel(panel: PanelKey, value: number): void;
  resetLayout(): void;
  fitLayout(width: number, height: number): void;
}

export function createPanelActions(deps: FeatureDeps): PanelActions {
  return {
    setActivity(activity: ActivityView): void {
      deps.dispatch({ type: "activityChanged", activity });
    },

    activateActivity(activity: ActivityView): void {
      const { layout } = deps.getState();
      if (layout.activity === activity && layout.sidebarVisible) {
        deps.dispatch({ type: "sidebarVisibilityChanged", visible: false });
        return;
      }
      deps.dispatch({ type: "activityChanged", activity });
    },

    toggleSidebar(): void {
      deps.dispatch({ type: "sidebarVisibilityChanged", visible: !deps.getState().layout.sidebarVisible });
    },

    toggleAi(): void {
      deps.dispatch({ type: "aiVisibilityChanged", visible: !deps.getState().layout.aiVisible });
    },

    toggleBottom(): void {
      deps.dispatch({ type: "bottomVisibilityChanged", visible: !deps.getState().layout.bottomVisible });
    },

    toggleBottomView(view: BottomView): void {
      const { layout } = deps.getState();
      if (layout.bottomView === view && layout.bottomVisible) {
        deps.dispatch({ type: "bottomVisibilityChanged", visible: false });
        return;
      }
      deps.dispatch({ type: "bottomViewChanged", view });
    },

    resizePanel(panel: PanelKey, value: number): void {
      deps.dispatch({ type: "panelResized", panel, value });
    },

    resetLayout(): void {
      deps.dispatch({ type: "layoutReset" });
    },

    fitLayout(width: number, height: number): void {
      deps.dispatch({ type: "layoutFit", width, height });
    },
  };
}
