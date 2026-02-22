import { test, expect } from "@playwright/test";

test("mic button is present in the DOM on home page", async ({ page }) => {
  await page.goto("/");
  // The mic button is only rendered when isVoiceSupported() returns true.
  // In Playwright's Chromium, SpeechRecognition may or may not be present.
  // We assert it exists if voice is supported, otherwise the unsupported notice shows.
  const micButton = page.getByRole("button", { name: /start voice input/i });
  const unsupportedNotice = page.getByText(/voice not supported/i);

  const micCount = await micButton.count();
  const noticeCount = await unsupportedNotice.count();

  // One of the two must be present — either mic button or unsupported notice
  expect(micCount + noticeCount).toBeGreaterThan(0);
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
