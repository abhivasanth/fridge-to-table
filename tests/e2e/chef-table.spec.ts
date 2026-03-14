import { test, expect } from "@playwright/test";

test("Chef's Table tab is visible on home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /chef's table/i })).toBeVisible();
});

test("Chef's Table tab shows chef grid when active", async ({ page }) => {
  await page.goto("/?tab=chefs-table");
  // Wait for the chef grid to load (skeleton resolves to actual chef names)
  await expect(page.getByText("Choose your chefs")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Gordon Ramsay/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Maangchi/i })).toBeVisible();
});

test("Any Recipe tab shows filters panel, not chef grid", async ({ page }) => {
  await page.goto("/");
  // Default tab is Any Recipe — chef grid header should not be visible
  await expect(page.getByText("Choose your chefs")).not.toBeVisible();
  await expect(page.getByText(/add filters/i)).toBeVisible();
});

test("Find Recipes is disabled on Chef's Table with no chefs selected", async ({
  page,
}) => {
  await page.goto("/?tab=chefs-table");
  // Wait for the chef grid to fully load
  await expect(page.getByText("Choose your chefs")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, eggs");
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeDisabled();
});

test("Find Recipes is enabled on Chef's Table after selecting a chef", async ({
  page,
}) => {
  await page.goto("/?tab=chefs-table");
  // Wait for the chef grid to fully load
  await expect(page.getByText("Choose your chefs")).toBeVisible({ timeout: 10_000 });
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, eggs");
  // Click Gordon Ramsay in the chef grid (use role to avoid matching features section text)
  await page.getByRole("button", { name: /Gordon Ramsay/i }).first().click();
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeEnabled();
});

test("Chef selection persists in localStorage", async ({ page }) => {
  await page.goto("/?tab=chefs-table");
  // Wait for the chef grid to fully load
  await expect(page.getByText("Choose your chefs")).toBeVisible({ timeout: 10_000 });
  // Click Gordon Ramsay in the chef grid (use role to avoid matching features section text)
  await page.getByRole("button", { name: /Gordon Ramsay/i }).first().click();

  const stored = await page.evaluate(() =>
    localStorage.getItem("fridgeToTable_selectedChefs")
  );
  expect(JSON.parse(stored!)).toContain("gordon-ramsay");
});

test("Chef selection is restored on next visit", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "fridgeToTable_selectedChefs",
      JSON.stringify(["gordon-ramsay"])
    )
  );
  await page.goto("/?tab=chefs-table");
  // Wait for the chef grid to fully load (not skeleton)
  await expect(page.getByText("Choose your chefs")).toBeVisible({ timeout: 10_000 });
  // The "1 selected" count should appear with saved selection
  await expect(page.getByText(/1 selected/i)).toBeVisible();
});
