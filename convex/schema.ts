import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// Two tables: recipes (generated sets) and favourites (saved by user session).
export default defineSchema({
  // Each row stores one "search" — a set of 3 generated recipes for a session.
  recipes: defineTable({
    sessionId: v.string(),            // anonymous user UUID from localStorage
    ingredients: v.array(v.string()), // ingredients the user entered
    filters: v.object({
      cuisine: v.string(),            // free-text e.g. "Italian" or ""
      maxCookingTime: v.number(),     // max cooking time in minutes
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      ),
    }),
    results: v.array(v.any()),        // array of exactly 3 Recipe objects (JSON)
    generatedAt: v.number(),          // Date.now() timestamp
  }),

  // Tracks which recipes a session has saved as favourites.
  favourites: defineTable({
    sessionId: v.string(),
    recipeSetId: v.id("recipes"),     // references the recipes table
    recipeIndex: v.number(),          // 0, 1, or 2 — which of the 3 recipes
    savedAt: v.number(),
  }),
});
