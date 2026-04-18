import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// All user-owned tables are keyed by the Clerk user ID string (stored as `userId`).
// There is intentionally no `users` table — Clerk is the source of truth for
// identity; Clerk's dashboard shows every signed-up user with richer info
// than we'd mirror (sign-up method, session history, OAuth providers).
// Add a `users` table here only when a feature needs per-user server-side
// metadata (admin roles, notification preferences, analytics aggregates).
// TEMPORARY: schema validation disabled for one deploy cycle so the new
// auth schema can land on production even though old sessionId-keyed rows
// still exist. After this deploy succeeds, run `migrations.wipeLegacyData`
// in the Convex dashboard, then restore `schemaValidation: true` in a
// follow-up PR. See chore/wipe-prod-legacy-data commit history.
export default defineSchema({
  // Each row stores one "search" — a set of 3 generated recipes for a user.
  recipes: defineTable({
    userId: v.string(),                // Clerk user ID
    ingredients: v.array(v.string()),
    filters: v.object({
      cuisine: v.string(),
      maxCookingTime: v.number(),
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
    results: v.array(v.any()),
    generatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Tracks which recipes a user has saved as favourites.
  favourites: defineTable({
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_recipe", ["userId", "recipeSetId", "recipeIndex"]),

  customChefs: defineTable({
    userId: v.string(),
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
  }).index("by_user", ["userId"]),

  pantryItems: defineTable({
    userId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    category: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "normalizedName"]),

  shoppingListItems: defineTable({
    userId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    source: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "normalizedName"]),
}, {
  // TEMPORARY — see top-of-file comment. Restore to `true` (default) after
  // running migrations.wipeLegacyData against production.
  schemaValidation: false,
});
