import { test, expect } from "@playwright/test";

test.describe("v3 single page", () => {
  test("shows hero state on load", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("What's in your fridge?")).toBeVisible();
    await expect(page.getByText("Tell us your ingredients")).toBeVisible();
  });

  test("input bar has + mic and ↑ send", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByLabel("Add photo")).toBeVisible();
    await expect(page.getByLabel("Find recipes")).toBeVisible();
  });

  test("shows 6 chef slots", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Gordon Ramsay")).toBeVisible();
    await expect(page.getByText("Jamie Oliver")).toBeVisible();
    await expect(page.locator("text=+ Add chef")).toHaveCount(2);
  });

  test("hamburger opens sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Open menu").click();
    await expect(page.getByText("+ New search")).toBeVisible();
  });

  test("sidebar closes on backdrop tap", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Open menu").click();
    await page.locator("[data-testid='backdrop']").click({ position: { x: 350, y: 300 } });
    await expect(page.getByText("+ New search")).not.toBeInViewport();
  });

  test("back button clears results", async ({ page }) => {
    await page.goto("/");
    await page.locator("textarea").click();
    await page.locator("textarea").pressSequentially("eggs, milk");
    await page.getByLabel("Find recipes").click();
    await expect(page.getByText("Finding recipes...")).toBeVisible();
    await page.getByText("← Back").click({ timeout: 15000 });
    await expect(page.getByText("What's in your fridge?")).toBeVisible();
  });

  test("filter pills expand and collapse", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Filters (optional)").click();
    await expect(page.getByText("Under 30 mins")).toBeVisible();
    await expect(page.getByText("Spicy")).toBeVisible();
    await page.getByText("Filters (optional)").click();
    await expect(page.getByText("Under 30 mins")).not.toBeVisible();
  });
});
