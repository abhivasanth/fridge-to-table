import { test, expect } from "@playwright/test";

test("Chef's Table tab is visible on home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /chef's table/i })).toBeVisible();
});

test("Chef's Table tab shows chef grid when active", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await expect(page.getByText("Gordon Ramsay")).toBeVisible();
  await expect(page.getByText("Maangchi")).toBeVisible();
});

test("Any Recipe tab shows filters panel, not chef grid", async ({ page }) => {
  await page.goto("/");
  // Default tab is Any Recipe
  await expect(page.getByText("Gordon Ramsay")).not.toBeVisible();
  await expect(page.getByText(/add filters/i)).toBeVisible();
});

test("Find Recipes is disabled on Chef's Table with no chefs selected", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, eggs");
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeDisabled();
});

test("Find Recipes is enabled on Chef's Table after selecting a chef", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, eggs");
  await page.getByText("Gordon Ramsay").click();
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeEnabled();
});

test("Chef selection persists in localStorage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await page.getByText("Gordon Ramsay").click();

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
  await page.reload();
  await page.getByRole("button", { name: /chef's table/i }).click();
  // The "1 selected" count should appear after reloading with saved selection
  await expect(page.getByText(/1 selected/i)).toBeVisible();
});
