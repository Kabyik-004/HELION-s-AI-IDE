import type { FeatureDeps } from "../../app/featureContext";
import type { EditorProblem } from "../../shared/types/problem";

/**
 * The editor's trivial commands.
 *
 * These are single state transitions with no orchestration, kept together because they are all
 * "the editor asking to change its own small piece of state". Real behaviour — opening, saving,
 * closing, reloading — lives in its own module next to this one.
 */
export interface EditorActions {
  activateTab(path: string): void;
  /** Records a keystroke's new buffer contents. */
  updateBuffer(path: string, content: string): void;
  setCursor(line: number, column: number): void;
  setProblems(problems: readonly EditorProblem[]): void;
}

export function createEditorActions(deps: FeatureDeps): EditorActions {
  return {
    activateTab(path: string): void {
      deps.dispatch({ type: "tabActivated", path });
      deps.dispatch({ type: "pathSelected", path });
    },

    updateBuffer(path: string, content: string): void {
      deps.dispatch({ type: "bufferChanged", path, content });
    },

    setCursor(line: number, column: number): void {
      deps.dispatch({ type: "cursorMoved", line, column });
    },

    setProblems(problems: readonly EditorProblem[]): void {
      deps.dispatch({ type: "problemsReplaced", problems });
    },
  };
}
