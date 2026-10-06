// Cross-platform cleanup for build artefacts produced by this monorepo.
// Usage: npm run clean
import { rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));

const targets = [
  "apps/desktop/dist",
  "apps/desktop/node_modules/.vite",
  "apps/desktop/src-tauri/target",
  "node_modules/.cache",
];

await Promise.all(
  targets.map(async (relative) => {
    const absolute = join(root, relative);
    await rm(absolute, { recursive: true, force: true });
    console.log(`cleaned ${relative}`);
  }),
);
