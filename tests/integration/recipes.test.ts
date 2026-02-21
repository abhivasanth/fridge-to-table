import { convexTest } from "convex-test";
import { describe, test, expect, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Recipe } from "../../types/recipe";

// A minimal valid recipe object matching the Recipe type
const mockRecipe: Recipe = {
  title: "Spinach Omelette",
  description: "A quick, nutritious breakfast.",
  cookingTime: 15,
  difficulty: "easy",
  servings: 2,
  cuisineType: "French",
  ingredients: [
    { name: "eggs", amount: "3 large", inFridge: true },
    { name: "spinach", amount: "handful", inFridge: true },
    { name: "feta", amount: "50g", inFridge: false },
  ],
  steps: ["Beat eggs", "Wilt spinach", "Cook omelette"],
  shoppingList: ["feta"],
};

// Must use function (not arrow) because it's called with `new`
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              // Claude must return exactly 3 recipes
              text: JSON.stringify([mockRecipe, mockRecipe, mockRecipe]),
            },
          ],
        }),
      },
    };
  });
  return { default: MockAnthropic };
});

describe("generateRecipes", () => {
  test("saves a recipe set to the database and returns its ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      sessionId: "session-abc",
      ingredients: ["eggs", "spinach"],
      filters: { cuisine: "French", maxCookingTime: 30, difficulty: "easy" },
    });

    // Verify the record was written to the database
    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));

    expect(saved).not.toBeNull();
    expect(saved!.sessionId).toBe("session-abc");
    expect(saved!.ingredients).toEqual(["eggs", "spinach"]);
    expect(saved!.results).toHaveLength(3);
  });

  test("getRecipeSet returns the saved recipe set by ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      sessionId: "session-xyz",
      ingredients: ["tomatoes", "pasta"],
      filters: { cuisine: "", maxCookingTime: 45, difficulty: "medium" },
    });

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(3);
  });
});
