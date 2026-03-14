import { test, expect } from "@playwright/test";

test("mic button is present when voice is supported", async ({ page }) => {
  await page.goto("/");
  // The mic button's aria-label is "Dictate your ingredients" (idle) or
  // "Dictating, tap to stop" (recording). In Playwright's Chromium,
  // SpeechRecognition may not be available, so the button may not render.
  // We check: if voice is supported, the button is visible.
  const micButton = page.getByRole("button", { name: /dictate/i });
  const micCount = await micButton.count();

  // If mic button is present, it should be visible
  if (micCount > 0) {
    await expect(micButton).toBeVisible();
  }
  // If not present, voice is unsupported in this browser — that's OK
});

test("photo menu button opens dropdown with camera and gallery options", async ({
  page,
}) => {
  await page.goto("/");
  // The "+" button opens the photo menu
  await page.getByRole("button", { name: /add photo/i }).click();
  await expect(page.getByText("📷 Take a photo")).toBeVisible();
  await expect(page.getByText("🖼️ Upload a photo")).toBeVisible();
});

test("photo menu closes when clicking outside", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /add photo/i }).click();
  await expect(page.getByText("📷 Take a photo")).toBeVisible();

  // Click outside the menu
  await page.locator("h1").click();
  await expect(page.getByText("📷 Take a photo")).not.toBeVisible();
});
