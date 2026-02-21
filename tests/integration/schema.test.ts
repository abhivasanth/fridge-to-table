import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import schema from "../../convex/schema";

// Smoke test: verifies the schema is valid and tables can be inserted into
describe("schema", () => {
  test("can insert and retrieve a recipe set", async () => {
    const t = convexTest(schema);

    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        sessionId: "test-session",
        ingredients: ["eggs", "tomatoes"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc).not.toBeNull();
    expect(doc!.sessionId).toBe("test-session");
  });

  test("can insert and retrieve a favourite", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        sessionId: "test-session",
        ingredients: [],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });

    const favId = await t.run(async (ctx) => {
      return await ctx.db.insert("favourites", {
        sessionId: "test-session",
        recipeSetId,
        recipeIndex: 0,
        savedAt: Date.now(),
      });
    });

    const fav = await t.run(async (ctx) => ctx.db.get(favId));
    expect(fav!.recipeIndex).toBe(0);
  });
});
