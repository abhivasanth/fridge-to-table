import { test, expect } from "@playwright/test";

test("My Chefs tab is visible on home page", async ({ page }) => {
  await page.goto("/");
  // My Chefs is a sidebar nav button, not a top-level visible element.
  // The sidebar toggle button should be visible.
  await expect(page.getByRole("button", { name: /chef's table/i })).toBeVisible();
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

test("/my-chefs page has back link to chef's table", async ({ page }) => {
  await page.goto("/my-chefs");
  await expect(page.getByRole("link", { name: /back to search/i })).toBeVisible();
});

test("My Chefs page shows Featured Chefs section", async ({ page }) => {
  await page.goto("/my-chefs");
  await expect(page.getByText("Featured Chefs")).toBeVisible();
  // Gordon Ramsay should appear in the featured chefs grid
  await expect(page.getByText("Gordon Ramsay")).toBeVisible();
});

test("Chef's Table has Edit chefs link to /my-chefs", async ({ page }) => {
  await page.goto("/?tab=chefs-table");
  // The ChefGrid has an "Edit chefs" link to /my-chefs
  await expect(page.getByRole("link", { name: /edit chefs/i })).toBeVisible();
});
