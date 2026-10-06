import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end tests for the workspace, file operations and the editor.
 *
 * These run in a browser, where ForgeAI uses its in-memory example project through the same
 * `FileSystemPort` the desktop app implements against real disk. Everything asserted here —
 * listing, reading, creating, renaming, deleting, dirty tracking — is therefore real logic, and
 * the path-confinement rules themselves are covered by the Rust unit tests (`cargo test`).
 */

/**
 * Editor tabs only. The bottom dock also uses `role="tab"`, so counts must be scoped to the
 * editor's tab list.
 */
const editorTabs = (page: Page) => page.getByRole("tablist", { name: "Open editors" }).getByRole("tab");

/** The unsaved-changes dot rendered inside a tab. */
const unsavedDot = (page: Page, name: RegExp) =>
  page.getByRole("tab", { name }).locator("[title='Unsaved changes']");

/** Right-clicks a node and returns the menu that appears. */
async function openNodeMenu(page: Page, name: string) {
  await page.getByRole("treeitem", { name }).click({ button: "right" });
  return page.getByRole("menu");
}

test.describe("explorer navigation", () => {
  test("expands nested folders lazily and shows real contents", async ({ page }) => {
    await page.goto("/");

    // Root entries come from the file system, directories first.
    await expect(page.getByRole("treeitem", { name: "src" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "package.json" })).toBeVisible();

    await page.getByRole("treeitem", { name: "src" }).click();
    await expect(page.getByRole("treeitem", { name: "components" })).toBeVisible();

    // A second level is only read once it is expanded.
    await page.getByRole("treeitem", { name: "components" }).click();
    await expect(page.getByRole("treeitem", { name: "Button.tsx" })).toBeVisible();

    // Collapsing hides the children again.
    await page.getByRole("treeitem", { name: "components" }).click();
    await expect(page.getByRole("treeitem", { name: "Button.tsx" })).toBeHidden();
  });

  test("opens a file, keeps several tabs, and switches between them", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("treeitem", { name: "package.json" }).click();
    await page.getByRole("treeitem", { name: "README.md" }).click();

    await expect(editorTabs(page)).toHaveCount(2);
    await expect(page.getByRole("tab", { name: /README\.md/ })).toHaveAttribute("aria-selected", "true");

    // Selecting an already-open file focuses its existing tab instead of duplicating it.
    await page.getByRole("treeitem", { name: "package.json" }).click();
    await expect(editorTabs(page)).toHaveCount(2);
    await expect(page.getByRole("tab", { name: /package\.json/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".view-lines").first()).toContainText("forgeai-demo");

    // Closing a tab removes it and activates a neighbour.
    await page.getByRole("tab", { name: /package\.json/ }).getByRole("button", { name: /Close/ }).click();
    await expect(editorTabs(page)).toHaveCount(1);
  });

  test("reports binary files instead of loading them into the editor", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("treeitem", { name: "public" }).click();
    await page.getByRole("treeitem", { name: "logo.png" }).click();

    await expect(page.getByText("Binary file")).toBeVisible();
    await expect(page.locator(".monaco-editor")).toHaveCount(0);
  });
});

test.describe("file operations", () => {
  test("creates a file and opens it", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New file" }).click();
    await page.getByLabel("File name").fill("notes.md");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByRole("treeitem", { name: "notes.md" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /notes\.md/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".monaco-editor")).toBeAttached();
  });

  test("creates a folder", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New folder" }).click();
    await page.getByLabel("Folder name").fill("docs");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByRole("treeitem", { name: "docs" })).toBeVisible();
  });

  test("rejects an invalid name before touching the file system", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New file" }).click();
    await page.getByLabel("File name").fill("bad:name.txt");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(/cannot contain/i)).toBeVisible();
    // The dialog stays open so the name can be corrected.
    await expect(page.getByLabel("File name")).toBeVisible();
  });

  test("rejects a name that already exists", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New file" }).click();
    await page.getByLabel("File name").fill("README.md");
    await page.getByRole("button", { name: "Create" }).click();

    await expect(page.getByText(/already exists/i)).toBeVisible();
  });

  test("renames a file and updates its open tab", async ({ page }) => {
    await page.goto("/");

    // Open it first, so the rename has to move an open buffer too.
    await page.getByRole("treeitem", { name: "README.md" }).click();
    await expect(page.getByRole("tab", { name: /README\.md/ })).toBeVisible();
    await expect(unsavedDot(page, /README\.md/)).toHaveCount(0);

    const menu = await openNodeMenu(page, "README.md");
    await menu.getByRole("menuitem", { name: "Rename…" }).click();

    await page.getByLabel("New name").fill("GUIDE.md");
    await page.getByRole("button", { name: "Rename" }).click();

    await expect(page.getByRole("treeitem", { name: "GUIDE.md" })).toBeVisible();
    await expect(page.getByRole("treeitem", { name: "README.md" })).toHaveCount(0);

    // The tab followed the rename and did not become dirty.
    await expect(page.getByRole("tab", { name: /GUIDE\.md/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: /README\.md/ })).toHaveCount(0);
    await expect(unsavedDot(page, /GUIDE\.md/)).toHaveCount(0);
    await expect(page.locator(".view-lines").first()).toContainText("forgeai-demo");
  });

  test("renames a folder", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("treeitem", { name: "public" }).click();
    const menu = await openNodeMenu(page, "public");
    await menu.getByRole("menuitem", { name: "Rename…" }).click();

    await page.getByLabel("New name").fill("assets");
    await page.getByRole("button", { name: "Rename" }).click();

    await expect(page.getByRole("treeitem", { name: "assets" })).toBeVisible();
    // Expanded state follows the move, so the child is still listed.
    await expect(page.getByRole("treeitem", { name: "logo.svg" })).toBeVisible();
  });

  test("requires confirmation before deleting, and closes the deleted file's tab", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("treeitem", { name: "README.md" }).click();
    await expect(page.getByRole("tab", { name: /README\.md/ })).toBeVisible();

    const menu = await openNodeMenu(page, "README.md");
    await menu.getByRole("menuitem", { name: "Delete" }).click();

    // The dialog explains what will happen and demands a decision.
    await expect(page.getByRole("dialog")).toContainText("permanently");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("treeitem", { name: "README.md" })).toBeVisible();

    await (await openNodeMenu(page, "README.md")).getByRole("menuitem", { name: "Delete" }).click();
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("treeitem", { name: "README.md" })).toHaveCount(0);
    await expect(page.getByRole("tab", { name: /README\.md/ })).toHaveCount(0);
  });

  test("deletes a folder, warning that its contents go with it", async ({ page }) => {
    await page.goto("/");

    const menu = await openNodeMenu(page, "public");
    await menu.getByRole("menuitem", { name: "Delete" }).click();

    await expect(page.getByRole("dialog")).toContainText("everything inside it");
    await page.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("treeitem", { name: "public" })).toHaveCount(0);
  });
});

test.describe("unsaved changes", () => {
  test("asks before closing a dirty file and honours each answer", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("treeitem", { name: "README.md" }).click();

    await page.locator(".view-lines").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" EDITED");
    await expect(unsavedDot(page, /README\.md/)).toBeVisible();

    // Cancel keeps the tab.
    await page.keyboard.press("Control+w");
    await expect(page.getByRole("dialog")).toContainText("unsaved changes");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("tab", { name: /README\.md/ })).toBeVisible();
    await expect(unsavedDot(page, /README\.md/)).toBeVisible();

    // Don't Save closes it and discards the edit.
    await page.keyboard.press("Control+w");
    await page.getByRole("button", { name: "Don't Save" }).click();
    await expect(editorTabs(page)).toHaveCount(0);
  });

  test("saves an edit, clears the dirty marker, and keeps the text after reopening", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("treeitem", { name: "README.md" }).click();

    await page.locator(".view-lines").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" EXTRA");
    await expect(unsavedDot(page, /README\.md/)).toBeVisible();

    await page.keyboard.press("Control+s");

    // The write completed without error: no notification, and the dirty marker clears.
    // (Writing to real disk is covered by the Rust unit tests; these run against the in-memory
    // example project through the same FileSystemPort.)
    await expect(unsavedDot(page, /README\.md/)).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveCount(0);

    // Reopening the file does not resurrect a dirty state or lose the edit.
    await page.getByRole("tab", { name: /README\.md/ }).getByRole("button", { name: /Close/ }).click();
    await page.getByRole("treeitem", { name: "README.md" }).click();
    await expect(page.locator(".view-lines").first()).toContainText("EXTRA");
    await expect(unsavedDot(page, /README\.md/)).toHaveCount(0);
  });

  test("closing a dirty file prompts even from the Save path", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("treeitem", { name: "package.json" }).click();

    await page.locator(".view-lines").first().click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type(" ");
    await expect(unsavedDot(page, /package\.json/)).toBeVisible();

    await page.keyboard.press("Control+w");
    // "Save" also matches "Don't Save", so match the label exactly.
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Saved, then closed.
    await expect(editorTabs(page)).toHaveCount(0);
  });
});
