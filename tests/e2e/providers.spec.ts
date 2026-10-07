import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end tests for provider configuration and the API-key workflow.
 *
 * These run in a browser, where the credential store is deliberately in-memory (development only)
 * and configuration is not written to disk, so persistence across a reload and the OS keychain are
 * covered by the unit tests (`npm run test:unit`) and the Rust tests instead. What is verified here
 * is the user-visible workflow: adding a provider, masking its key, testing the connection, editing,
 * disabling, removing the key and deleting the provider — and that the secret never reaches the page.
 */

const SECRET = "TEST_SECRET_DO_NOT_LEAK_123456";

async function openSettings(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Activity" }).getByRole("button", { name: "Settings" }).click();
  await expect(page.getByText("Providers", { exact: true })).toBeVisible();
}

async function addOpenAi(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Add provider" }).click();
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Model").fill("gpt-4o-mini");
  await page.getByLabel("API key").fill(SECRET);
  await page.getByRole("button", { name: "Save provider" }).click();
  await expect(page.getByRole("group", { name })).toBeVisible();
}

test.describe("provider settings", () => {
  test("adds a provider, masks its key, and never puts the secret in the page", async ({ page }) => {
    await openSettings(page);
    await addOpenAi(page, "OpenAI Personal");

    const card = page.getByRole("group", { name: "OpenAI Personal" });
    // The stored key is masked: the UI knows only that one exists.
    await expect(card.getByText(/configured/)).toBeVisible();
    // The first configured provider becomes the active one.
    await expect(card.getByRole("button", { name: "In use" })).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain(SECRET);
  });

  test("reports missing fields instead of saving", async ({ page }) => {
    await openSettings(page);
    await page.getByRole("button", { name: "Add provider" }).click();
    await page.getByLabel("API key").fill("sk-something");
    await page.getByRole("button", { name: "Save provider" }).click();

    await expect(page.getByText("Enter a display name.")).toBeVisible();
    // The form stays open so the value can be corrected.
    await expect(page.getByLabel("Display name")).toBeVisible();
  });

  test("tests a connection, reporting success and then a rejected key", async ({ page }) => {
    await openSettings(page);
    await addOpenAi(page, "OpenAI Personal");
    const card = page.getByRole("group", { name: "OpenAI Personal" });

    await page.route("https://api.openai.com/v1/models", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [] }) }),
    );
    await card.getByRole("button", { name: "Test connection" }).click();
    await expect(card.getByText(/Connected to/)).toBeVisible();

    await page.unroute("https://api.openai.com/v1/models");
    await page.route("https://api.openai.com/v1/models", (route) => route.fulfill({ status: 401, body: "nope" }));
    await card.getByRole("button", { name: "Test connection" }).click();
    await expect(card.getByText(/rejected the API key/)).toBeVisible();
  });

  test("edits a provider, disables it, and removes its key", async ({ page }) => {
    await openSettings(page);
    await addOpenAi(page, "OpenAI Personal");

    await page.getByRole("button", { name: "Edit OpenAI Personal" }).click();
    await page.getByLabel("Display name").fill("OpenAI Work");
    await page.getByRole("button", { name: "Save changes" }).click();

    const card = page.getByRole("group", { name: "OpenAI Work" });
    await expect(card).toBeVisible();
    await expect(page.getByRole("group", { name: "OpenAI Personal" })).toHaveCount(0);

    await card.getByRole("checkbox", { name: "Enabled" }).uncheck();
    await expect(card.getByRole("checkbox", { name: "Enabled" })).not.toBeChecked();

    await card.getByRole("button", { name: "Remove key" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Remove key" }).click();
    await expect(card.getByText("not set")).toBeVisible();

    const html = await page.content();
    expect(html).not.toContain(SECRET);
  });

  test("deletes a provider after confirmation", async ({ page }) => {
    await openSettings(page);
    await addOpenAi(page, "OpenAI Personal");

    await page.getByRole("button", { name: "Delete OpenAI Personal" }).click();
    await expect(page.getByRole("dialog")).toContainText("API key");
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();

    await expect(page.getByRole("group", { name: "OpenAI Personal" })).toHaveCount(0);
    await expect(page.getByText("No providers configured")).toBeVisible();
  });
});
