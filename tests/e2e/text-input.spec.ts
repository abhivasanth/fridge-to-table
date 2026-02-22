import { test, expect } from "@playwright/test";

// These tests make real calls to Convex and Claude API.
// Ensure npx convex dev is running and ANTHROPIC_API_KEY is set in Convex env.

test("Find Recipes button is disabled when no ingredients are entered", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeDisabled();
});

test("typing ingredients enables the Find Recipes button", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/type your ingredients/i).fill("eggs, spinach");
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeEnabled();
});

test("submitting ingredients shows 3 recipe cards on results page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByPlaceholder(/type your ingredients/i).fill("eggs, spinach, tomatoes");
  await page.getByRole("button", { name: /find recipes/i }).click();

  // Claude API may take up to 30 seconds — use a generous timeout
  await page.waitForURL(/\/results\//, { timeout: 30_000 });

  const recipeLinks = page.locator("a[href*='/recipe/']");
  await expect(recipeLinks).toHaveCount(3, { timeout: 5_000 });
});
