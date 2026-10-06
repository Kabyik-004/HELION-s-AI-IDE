/**
 * Whether the application is running inside the Tauri desktop shell.
 *
 * ForgeAI is developed and tested in two places: the real desktop app (where native capabilities
 * exist) and a plain browser (`npm run dev:web`, and the end-to-end tests). The composition root
 * uses this to decide which implementation of the capability ports to wire up, so the rest of the
 * code never asks the question.
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
