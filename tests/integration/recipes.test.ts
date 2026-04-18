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

describe("saveRecipeSet", () => {
  test("saves a recipe set and returns its ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.mutation(api.recipes.saveRecipeSet, {
      userId: "session-save-1",
      ingredients: ["chicken", "onions"],
      filters: { cuisine: "Indian", maxCookingTime: 30, difficulty: "medium" },
      results: [mockRecipe, mockRecipe, mockRecipe],
    });

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe("session-save-1");
    expect(saved!.ingredients).toEqual(["chicken", "onions"]);
    expect(saved!.results).toHaveLength(3);
    expect(saved!.generatedAt).toBeTypeOf("number");
  });

  test("saved recipe set is retrievable via getRecipeSet", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.mutation(api.recipes.saveRecipeSet, {
      userId: "session-save-2",
      ingredients: ["rice", "eggs"],
      filters: { cuisine: "", maxCookingTime: 20, difficulty: "easy" },
      results: [mockRecipe],
    });

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("session-save-2");
    expect(result!.results).toHaveLength(1);
  });

  test("stores filters correctly including difficulty variants", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.mutation(api.recipes.saveRecipeSet, {
      userId: "session-save-3",
      ingredients: ["salmon"],
      filters: { cuisine: "Japanese", maxCookingTime: 60, difficulty: "hard" },
      results: [mockRecipe, mockRecipe, mockRecipe],
    });

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved!.filters.cuisine).toBe("Japanese");
    expect(saved!.filters.maxCookingTime).toBe(60);
    expect(saved!.filters.difficulty).toBe("hard");
  });

  test("handles empty cuisine string", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.mutation(api.recipes.saveRecipeSet, {
      userId: "session-save-4",
      ingredients: ["potatoes", "butter"],
      filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
      results: [mockRecipe, mockRecipe, mockRecipe],
    });

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved).not.toBeNull();
    expect(saved!.filters.cuisine).toBe("");
  });
});

describe("generateRecipes", () => {
  test("saves a recipe set to the database and returns its ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      userId: "session-abc",
      ingredients: ["eggs", "spinach"],
      filters: { cuisine: "French", maxCookingTime: 30, difficulty: "easy" },
    });

    // Verify the record was written to the database
    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));

    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe("session-abc");
    expect(saved!.ingredients).toEqual(["eggs", "spinach"]);
    expect(saved!.results).toHaveLength(3);
  });

  test("getRecipeSet returns the saved recipe set by ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      userId: "session-xyz",
      ingredients: ["tomatoes", "pasta"],
      filters: { cuisine: "", maxCookingTime: 45, difficulty: "medium" },
    });

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(3);
  });
});
