import { test, expect } from "@playwright/test";

test("My Chefs tab is visible on home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /my chefs/i })).toBeVisible();
});

test("My Chefs tab shows empty state with link when no chefs saved", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /my chefs/i }).click();
  await expect(page.getByText(/haven't added any chefs/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /set up my chefs/i })).toBeVisible();
});

test("/my-chefs page loads and shows add input", async ({ page }) => {
  await page.goto("/my-chefs");
  // Placeholder is "YouTube channel URL or @handle"
  await expect(page.getByPlaceholder(/youtube channel url/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^find$/i })).toBeVisible();
});

test("shows parse error for invalid input", async ({ page }) => {
  await page.goto("/my-chefs");
  await page.getByPlaceholder(/youtube channel url/i).fill("not a url");
  await page.getByRole("button", { name: /^find$/i }).click();
  // Error message: "Paste a YouTube channel URL or @handle"
  await expect(page.getByText(/paste a youtube channel url/i)).toBeVisible();
});

test("My Chefs nav link is visible in navbar", async ({ page }) => {
  await page.goto("/");
  // The navbar contains a "My Chefs" link (span inside Link to /my-chefs)
  await expect(page.getByRole("link", { name: /my chefs/i }).first()).toBeVisible();
});

test("My Chefs nav link navigates to /my-chefs", async ({ page }) => {
  await page.goto("/");
  // Click the navbar My Chefs link (first occurrence — the navbar link)
  await page.getByRole("link", { name: /my chefs/i }).first().click();
  await expect(page).toHaveURL("/my-chefs");
});

test("search button not available in My Chefs tab when list is empty", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /my chefs/i }).click();
  await expect(page.getByText(/haven't added any chefs/i)).toBeVisible();
  // The ingredient input is not rendered in the empty state on the My Chefs tab
  // The "Find Recipes" button should not be present/enabled because no chefs are selected
  const findButton = page.getByRole("button", { name: /find recipes/i });
  const isDisabledOrAbsent = await findButton.isDisabled().catch(() => true);
  expect(isDisabledOrAbsent).toBe(true);
});
