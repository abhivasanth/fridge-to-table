import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Saves a recipe to the user's favourites list.
// Silently ignores duplicate saves (idempotent).
export const saveFavourite = mutation({
  args: {
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(), // 0, 1, or 2
  },
  handler: async (ctx, args) => {
    // Check for an existing entry to prevent duplicates
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (!existing) {
      await ctx.db.insert("favourites", {
        userId: args.userId,
        recipeSetId: args.recipeSetId,
        recipeIndex: args.recipeIndex,
        savedAt: Date.now(),
      });
    }
  },
});

// Removes a recipe from the user's favourites list.
// Silently ignores if the entry doesn't exist.
export const removeFavourite = mutation({
  args: {
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Returns all favourites for a session, sorted most-recently-saved first.
export const getFavourites = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favourites")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .collect();
  },
});
