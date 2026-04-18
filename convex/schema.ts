import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// All user-owned tables are keyed by the Clerk user ID string (stored as `userId`).
export default defineSchema({
  // Users — mirrors Clerk identity for attaching app-specific data later.
  // Created on first sign-in via getOrCreateUser mutation.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

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
});
