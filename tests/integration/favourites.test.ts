import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

describe("favourites", () => {
  // Helper: inserts a dummy recipe set owned by `clerkId` and returns its ID
  async function createRecipeSet(
    t: ReturnType<typeof convexTest>,
    clerkId = "user_alice"
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        userId: clerkId,
        ingredients: ["eggs"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });
  }

  test("saveFavourite stores a favourite for the authenticated user", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await withUser(t, "user_alice").query(
      api.favourites.getFavourites,
      {}
    );

    expect(favourites).toHaveLength(1);
    expect(favourites[0].recipeSetId).toBe(recipeSetId);
    expect(favourites[0].recipeIndex).toBe(0);
  });

  test("saveFavourite does not create duplicate entries", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
      recipeSetId,
      recipeIndex: 0,
    });
    await withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await withUser(t, "user_alice").query(
      api.favourites.getFavourites,
      {}
    );
    expect(favourites).toHaveLength(1);
  });

  test("removeFavourite deletes the correct favourite", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
      recipeSetId,
      recipeIndex: 1,
    });
    await withUser(t, "user_alice").mutation(api.favourites.removeFavourite, {
      recipeSetId,
      recipeIndex: 1,
    });

    const favourites = await withUser(t, "user_alice").query(
      api.favourites.getFavourites,
      {}
    );
    expect(favourites).toHaveLength(0);
  });

  test("getFavourites only returns favourites for the authenticated user", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
      recipeSetId,
      recipeIndex: 0,
    });

    const favouritesBob = await withUser(t, "user_bob").query(
      api.favourites.getFavourites,
      {}
    );
    expect(favouritesBob).toHaveLength(0);
  });

  test("unauthenticated callers can't query getFavourites", async () => {
    const t = convexTest(schema);
    await expect(
      t.query(api.favourites.getFavourites, {})
    ).rejects.toThrow(/Not authenticated/);
  });

  test("unauthenticated callers can't call saveFavourite", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);
    await expect(
      t.mutation(api.favourites.saveFavourite, { recipeSetId, recipeIndex: 0 })
    ).rejects.toThrow(/Not authenticated/);
  });

  test("saveFavourite throws Forbidden when recipe set is owned by another user", async () => {
    const t = convexTest(schema);
    // Alice owns the recipe set
    const recipeSetId = await createRecipeSet(t, "user_alice");
    // Bob tries to favourite it
    await expect(
      withUser(t, "user_bob").mutation(api.favourites.saveFavourite, {
        recipeSetId,
        recipeIndex: 0,
      })
    ).rejects.toThrow(/Forbidden/);

    // And no row was planted
    const aliceFavourites = await withUser(t, "user_alice").query(
      api.favourites.getFavourites,
      {}
    );
    expect(aliceFavourites).toHaveLength(0);
  });

  test("saveFavourite throws Forbidden for a non-existent recipe set", async () => {
    const t = convexTest(schema);
    // Create and immediately delete a recipe set so we have a plausibly-shaped ID
    const recipeSetId = await createRecipeSet(t);
    await t.run(async (ctx) => await ctx.db.delete(recipeSetId));
    await expect(
      withUser(t, "user_alice").mutation(api.favourites.saveFavourite, {
        recipeSetId,
        recipeIndex: 0,
      })
    ).rejects.toThrow(/Forbidden/);
  });
});
