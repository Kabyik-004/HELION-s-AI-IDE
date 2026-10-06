import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the ForgeAI shell.
 *
 * They run against a real production build (`vite build` + `vite preview`) in Chromium, because
 * the questions worth answering here — does the shell render, do panels resize, are there console
 * errors — cannot be answered by type-checking alone.
 *
 * The Tauri window itself is validated separately by launching the built executable; these tests
 * cover the React application that runs inside it.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // A single worker keeps the assertions about console output attributable to one page.
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4173",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Always test a fresh build so the results cannot describe stale output.
    command: "npm run build:web --workspace @forgeai/desktop && npm run preview:web",
    url: "http://localhost:4173",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
