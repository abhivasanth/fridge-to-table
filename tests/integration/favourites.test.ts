import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("favourites", () => {
  // Helper: inserts a dummy recipe set and returns its ID
  async function createRecipeSet(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        userId: "session-123",
        ingredients: ["eggs"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });
  }

  test("saveFavourite stores a favourite", async () => {
    const t = convexTest(schema);

    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      userId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      userId: "session-123",
    });

    expect(favourites).toHaveLength(1);
    expect(favourites[0].recipeSetId).toBe(recipeSetId);
    expect(favourites[0].recipeIndex).toBe(0);
  });

  test("saveFavourite does not create duplicate entries", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    // Save the same recipe twice
    await t.mutation(api.favourites.saveFavourite, {
      userId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });
    await t.mutation(api.favourites.saveFavourite, {
      userId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      userId: "session-123",
    });
    expect(favourites).toHaveLength(1);
  });

  test("removeFavourite deletes the correct favourite", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      userId: "session-123",
      recipeSetId,
      recipeIndex: 1,
    });
    await t.mutation(api.favourites.removeFavourite, {
      userId: "session-123",
      recipeSetId,
      recipeIndex: 1,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      userId: "session-123",
    });
    expect(favourites).toHaveLength(0);
  });

  test("getFavourites only returns favourites for the given userId", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      userId: "session-A",
      recipeSetId,
      recipeIndex: 0,
    });

    const favouritesB = await t.query(api.favourites.getFavourites, {
      userId: "session-B",
    });
    expect(favouritesB).toHaveLength(0);
  });
});
