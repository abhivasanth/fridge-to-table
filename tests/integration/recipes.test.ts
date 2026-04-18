import { convexTest } from "convex-test";
import { describe, test, expect, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Recipe } from "../../types/recipe";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

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
  test("saves a recipe set for the authenticated user", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_save_1").mutation(
      api.recipes.saveRecipeSet,
      {
        ingredients: ["chicken", "onions"],
        filters: { cuisine: "Indian", maxCookingTime: 30, difficulty: "medium" },
        results: [mockRecipe, mockRecipe, mockRecipe],
      }
    );

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe("user_save_1");
    expect(saved!.ingredients).toEqual(["chicken", "onions"]);
    expect(saved!.results).toHaveLength(3);
    expect(saved!.generatedAt).toBeTypeOf("number");
  });

  test("saved recipe set is retrievable via getRecipeSet", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_save_2").mutation(
      api.recipes.saveRecipeSet,
      {
        ingredients: ["rice", "eggs"],
        filters: { cuisine: "", maxCookingTime: 20, difficulty: "easy" },
        results: [mockRecipe],
      }
    );

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user_save_2");
    expect(result!.results).toHaveLength(1);
  });

  test("unauthenticated callers can't save a recipe set", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.recipes.saveRecipeSet, {
        ingredients: ["x"],
        filters: { cuisine: "", maxCookingTime: 20, difficulty: "easy" },
        results: [mockRecipe],
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  test("stores filters correctly including difficulty variants", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_save_3").mutation(
      api.recipes.saveRecipeSet,
      {
        ingredients: ["salmon"],
        filters: { cuisine: "Japanese", maxCookingTime: 60, difficulty: "hard" },
        results: [mockRecipe, mockRecipe, mockRecipe],
      }
    );

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved!.filters.cuisine).toBe("Japanese");
    expect(saved!.filters.maxCookingTime).toBe(60);
    expect(saved!.filters.difficulty).toBe("hard");
  });

  test("handles empty cuisine string", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_save_4").mutation(
      api.recipes.saveRecipeSet,
      {
        ingredients: ["potatoes", "butter"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [mockRecipe, mockRecipe, mockRecipe],
      }
    );

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));
    expect(saved).not.toBeNull();
    expect(saved!.filters.cuisine).toBe("");
  });
});

describe("generateRecipes", () => {
  test("saves a recipe set to the database and returns its ID (derives userId from auth)", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_abc").action(
      api.recipes.generateRecipes,
      {
        ingredients: ["eggs", "spinach"],
        filters: { cuisine: "French", maxCookingTime: 30, difficulty: "easy" },
      }
    );

    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));

    expect(saved).not.toBeNull();
    expect(saved!.userId).toBe("user_abc");
    expect(saved!.ingredients).toEqual(["eggs", "spinach"]);
    expect(saved!.results).toHaveLength(3);
  });

  test("getRecipeSet returns the saved recipe set by ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await withUser(t, "user_xyz").action(
      api.recipes.generateRecipes,
      {
        ingredients: ["tomatoes", "pasta"],
        filters: { cuisine: "", maxCookingTime: 45, difficulty: "medium" },
      }
    );

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(3);
  });

  test("unauthenticated callers can't call generateRecipes", async () => {
    const t = convexTest(schema);
    await expect(
      t.action(api.recipes.generateRecipes, {
        ingredients: ["x"],
        filters: { cuisine: "", maxCookingTime: 20, difficulty: "easy" },
      })
    ).rejects.toThrow(/Not authenticated/);
  });
});
