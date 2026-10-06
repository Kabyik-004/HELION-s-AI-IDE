import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Resolves a path relative to this file into an absolute path.
 * (Works identically on Windows and POSIX, unlike naive string joins.)
 */
const fromHere = (relativePath: string): string => fileURLToPath(new URL(relativePath, import.meta.url));

/**
 * Vite is configured to consume the ForgeAI packages directly from source.
 *
 * Why aliases instead of building each package to `dist`?
 *  - one less build step during development, so `npm run dev` just works;
 *  - type-checking still covers every package (`npm run typecheck` runs `tsc` per package);
 *  - there is no chance of a stale `dist` masking an interface change.
 *
 * The alias list mirrors the `paths` map in `tsconfig.base.json`. Keep the two in sync.
 */
const workspaceAliases: Readonly<Record<string, string>> = {
  "@forgeai/shared": fromHere("../../packages/shared/src/index.ts"),
  "@forgeai/security": fromHere("../../packages/security/src/index.ts"),
  "@forgeai/tools": fromHere("../../packages/tools/src/index.ts"),
  "@forgeai/providers": fromHere("../../packages/providers/src/index.ts"),
  "@forgeai/agent": fromHere("../../packages/agent/src/index.ts"),
  "@forgeai/context": fromHere("../../packages/context/src/index.ts"),
  "@forgeai/git": fromHere("../../packages/git/src/index.ts"),
  "@forgeai/terminal": fromHere("../../packages/terminal/src/index.ts"),
  "@forgeai/storage": fromHere("../../packages/storage/src/index.ts"),
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: workspaceAliases,
  },
  // Tauri shows its own output; clearing the screen would wipe Rust errors.
  clearScreen: false,
  server: {
    // Fixed port so `tauri.conf.json` can point at it without guessing.
    port: 1420,
    strictPort: true,
    watch: {
      // Rust sources are watched by `cargo`, not Vite.
      ignored: ["**/src-tauri/**"],
    },
  },
  preview: {
    // Used by the end-to-end tests, which run against a real production build.
    port: 4173,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
