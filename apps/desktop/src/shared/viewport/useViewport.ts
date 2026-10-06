import { useEffect, useState } from "react";

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Tracks the window size.
 *
 * ForgeAI is a desktop tool, but windows get dragged narrow. Rather than reflow the whole
 * layout with media queries inside components, the shell reads one viewport value and decides
 * which panels can stay open — see the breakpoints below.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    // Sync once in case the window changed between render and effect.
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return viewport;
}

/** Below this width the AI panel collapses automatically. */
export const AI_PANEL_MIN_VIEWPORT = 1120;

/** Below this width the side panel collapses automatically. */
export const SIDEBAR_MIN_VIEWPORT = 720;
