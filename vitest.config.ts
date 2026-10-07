import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Resolves a repo-relative path to an absolute one, for the package aliases below. */
const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

/**
 * Vitest runs the framework-free parts of the application — validation, the provider service and
 * configuration — in Node. The `@forgeai/*` aliases mirror `tsconfig.base.json` so tests import
 * exactly the modules the app does.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@forgeai/shared": at("./packages/shared/src/index.ts"),
      "@forgeai/security": at("./packages/security/src/index.ts"),
      "@forgeai/tools": at("./packages/tools/src/index.ts"),
      "@forgeai/providers": at("./packages/providers/src/index.ts"),
      "@forgeai/agent": at("./packages/agent/src/index.ts"),
      "@forgeai/context": at("./packages/context/src/index.ts"),
      "@forgeai/git": at("./packages/git/src/index.ts"),
      "@forgeai/terminal": at("./packages/terminal/src/index.ts"),
      "@forgeai/storage": at("./packages/storage/src/index.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    reporters: "default",
  },
});
