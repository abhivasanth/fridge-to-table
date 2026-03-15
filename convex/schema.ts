import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// Tables: recipes, favourites, customChefs, pantryItems, shoppingListItems.
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
      diet: v.optional(v.union(
        v.literal("vegetarian"),
        v.literal("vegan"),
        v.literal("non-vegetarian")
      )),
    }),
    results: v.array(v.any()),        // array of exactly 3 Recipe objects (JSON)
    generatedAt: v.number(),          // Date.now() timestamp
  }).index("by_session", ["sessionId"]),

  // Tracks which recipes a session has saved as favourites.
  favourites: defineTable({
    sessionId: v.string(),
    recipeSetId: v.id("recipes"),     // references the recipes table
    recipeIndex: v.number(),          // 0, 1, or 2 — which of the 3 recipes
    savedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_recipe", ["sessionId", "recipeSetId", "recipeIndex"]),

  customChefs: defineTable({
    sessionId: v.string(),
    chefs: v.array(
      v.object({
        channelId: v.string(),
        channelName: v.string(),
        channelThumbnail: v.string(),
        addedAt: v.number(),
        resolvedAt: v.number(),
      })
    ),
    updatedAt: v.number(),
  }).index("by_session", ["sessionId"]),

  // Persistent pantry items — ingredients the user always has on hand.
  pantryItems: defineTable({
    sessionId: v.string(),
    name: v.string(),                // display name, lowercase trimmed
    normalizedName: v.string(),      // for matching/dedup
    category: v.string(),            // "oils_fats" | "spices_powders" | "sauces_condiments" | "basics" | "other"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_name", ["sessionId", "normalizedName"]),

  // Persistent shopping list — items the user wants to buy.
  shoppingListItems: defineTable({
    sessionId: v.string(),
    name: v.string(),                // display name
    normalizedName: v.string(),      // for matching/dedup
    source: v.string(),              // "manual" | "recipe"
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_name", ["sessionId", "normalizedName"]),
});
