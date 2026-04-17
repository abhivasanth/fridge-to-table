import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("basic"), v.literal("chef"))),
    stripePriceId: v.optional(v.string()),
    subscriptionStatus: v.string(),
    trialEndsAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_plan", ["plan"]),

  searchUsage: defineTable({
    userId: v.string(),
    searchedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_time", ["userId", "searchedAt"]),

  recipes: defineTable({
    userId: v.string(),
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
