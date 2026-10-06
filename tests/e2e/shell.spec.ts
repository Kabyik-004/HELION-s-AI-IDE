import { expect, test, type Page } from "@playwright/test";

/**
 * Smoke tests for the ForgeAI IDE shell.
 *
 * Each test starts from a fresh page load. Console errors and uncaught exceptions are collected
 * per test so a failure points at the message that caused it.
 */

/** Attaches console/error collectors and returns the array they write into. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`uncaught: ${error.message}`));
  return errors;
}

const activityBar = (page: Page) => page.getByRole("navigation", { name: "Activity" });
const aiPanel = (page: Page) => page.getByRole("region", { name: "AI assistant" });
const bottomPanel = (page: Page) => page.getByRole("region", { name: "Panel" });
const fileTree = (page: Page) => page.getByRole("tree", { name: "Project files" });

test.describe("shell layout", () => {
  test("renders every major region and reports no console errors", async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto("/");

    await expect(page.getByRole("menubar")).toBeVisible();
    await expect(page.getByText("ForgeAI", { exact: true }).first()).toBeVisible();
    await expect(activityBar(page)).toBeVisible();
    await expect(fileTree(page)).toBeVisible();
    await expect(bottomPanel(page)).toBeVisible();
    await expect(aiPanel(page)).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();

    // No file is open yet, so the welcome surface is shown rather than the editor.
    await expect(page.getByRole("heading", { level: 1, name: "ForgeAI" })).toBeVisible();
    await page.waitForTimeout(1000);

    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("lists the example project and opens a file into a tab", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");

    // Root entries from the file system port, directories first.
    await expect(page.getByRole("treeitem", { name: "src" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "package.json" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "README.md" })).toBeVisible();

    // Expanding a directory loads it lazily.
    await page.getByRole("treeitem", { name: "src" }).click();
    await expect(page.getByRole("treeitem", { name: "App.tsx" })).toBeVisible();

    await page.getByRole("treeitem", { name: "App.tsx" }).click();

    const tab = page.getByRole("tab", { name: /App\.tsx/ });
    await expect(tab).toHaveAttribute("aria-selected", "true");

    // The editor shows the file's own contents (proving the buffer was read, not faked).
    await expect(page.locator(".view-lines").first()).toContainText("useCounter");
    await expect(page.getByRole("contentinfo")).toContainText("typescript");

    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });

  test("marks unsaved edits and saves them without duplicating text", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("treeitem", { name: "README.md" }).click();

    const tab = page.getByRole("tab", { name: /README\.md/ });
    await expect(tab).toHaveAttribute("aria-selected", "true");

    // Type at the end of the first line.
    await page.locator(".view-lines").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("ZZZ");

    // The dirty indicator appears next to the project name in the title bar.
    await expect(page.locator("header").first()).toContainText("•");

    // A controlled Monaco value that round-trips incorrectly would duplicate the typed text.
    const content = await page.locator(".view-lines").first().innerText();
    expect(content.split("ZZZ").length - 1).toBe(1);

    // Ctrl+S clears the dirty state.
    await page.keyboard.press("Control+s");
    await expect(page.locator("header").first()).not.toContainText("•");
  });

  test("switches between the terminal and problems views", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");

    await expect(bottomPanel(page)).toContainText("No terminal session");

    await bottomPanel(page).getByRole("tab", { name: "Problems" }).click();
    await expect(bottomPanel(page)).toContainText("No problems");

    await bottomPanel(page).getByRole("tab", { name: "Terminal" }).click();
    await expect(bottomPanel(page)).toContainText("No terminal session");

    expect(errors, `console errors:\n${errors.join("\n")}`).toEqual([]);
  });
});

test.describe("AI assistant panel", () => {
  test("accepts a message and states plainly that no provider is connected", async ({ page }) => {
    await page.goto("/");

    await expect(aiPanel(page)).toContainText("I can help you understand and modify your project");

    await page.getByLabel("Message ForgeAI").fill("Explain src/App.tsx");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(aiPanel(page)).toContainText("Explain src/App.tsx");
    await expect(aiPanel(page)).toContainText("No provider is connected");

    // The stop control exists but must not claim to work.
    await expect(page.getByRole("button", { name: "Stop" })).toBeDisabled();
  });
});

test.describe("panel controls", () => {
  test("toggles the side panel with the keyboard", async ({ page }) => {
    await page.goto("/");
    await expect(fileTree(page)).toBeVisible();

    await page.keyboard.press("Control+b");
    await expect(fileTree(page)).toBeHidden();

    await page.keyboard.press("Control+b");
    await expect(fileTree(page)).toBeVisible();
  });

  test("resizes the side panel by dragging its divider", async ({ page }) => {
    await page.goto("/");

    const sidebar = fileTree(page).locator("xpath=ancestor::aside[1]");
    const before = (await sidebar.boundingBox())?.width ?? 0;
    expect(before).toBeGreaterThan(0);

    const handle = page.getByRole("separator", { name: "Resize side panel" });
    const box = await handle.boundingBox();
    if (box === null) throw new Error("resize handle has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();

    const after = (await sidebar.boundingBox())?.width ?? 0;
    expect(after).toBeGreaterThan(before + 40);
  });
});

test.describe("responsiveness", () => {
  test("collapses panels on narrow windows while keeping the controls reachable", async ({ page }) => {
    await page.goto("/");
    await expect(aiPanel(page)).toBeVisible();

    // Below the AI breakpoint the assistant collapses on its own.
    await page.setViewportSize({ width: 1000, height: 720 });
    await expect(aiPanel(page)).toBeHidden();
    await expect(fileTree(page)).toBeVisible();
    await expect(activityBar(page)).toBeVisible();

    // Below the sidebar breakpoint the explorer collapses too, but its toggle stays available.
    await page.setViewportSize({ width: 640, height: 600 });
    await expect(fileTree(page)).toBeHidden();
    await expect(activityBar(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /Toggle side panel/ })).toBeVisible();

    // Widening brings them back.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(fileTree(page)).toBeVisible();
    await expect(aiPanel(page)).toBeVisible();
  });
});
