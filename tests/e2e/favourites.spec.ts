import { test, expect } from "@playwright/test";

test("user can save and remove a favourite recipe", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, tomatoes, basil");
  await page.getByRole("button", { name: /find recipes/i }).click();

  await page.waitForURL(/\/results\//, { timeout: 30_000 });

  // Click the first recipe card
  await page.locator("a[href*='/recipe/']").first().click();
  await page.waitForURL(/\/recipe\//);

  // Save to favourites — aria-label changes to "Remove from favourites" when saved
  await page.getByRole("button", { name: /save to favourites/i }).click();
  await expect(page.getByRole("button", { name: /remove from favourites/i })).toBeVisible({ timeout: 10_000 });

  // Go to favourites page and verify the recipe is there
  await page.goto("/favourites");
  await expect(page.locator("a[href*='/recipe/']")).toHaveCount(1);

  // Remove the favourite
  await page.getByRole("button", { name: /remove from favourites/i }).click();
  await expect(page.getByText("No favourites yet")).toBeVisible({ timeout: 10_000 });
});
