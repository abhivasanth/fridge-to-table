import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./auth";

// Saves a recipe to the user's favourites list.
// Silently ignores duplicate saves (idempotent).
// Throws "Forbidden" if the caller tries to favourite a recipe set owned by
// another user — mirrors the ownership-check pattern used by delete-by-ID
// mutations (pantry.removeFromPantry, shoppingList.removeFromShoppingList)
// so cross-user Convex IDs can't be used to plant orphan rows.
export const saveFavourite = mutation({
  args: {
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(), // 0, 1, or 2
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const recipeSet = await ctx.db.get(args.recipeSetId);
    if (!recipeSet || recipeSet.userId !== userId) {
      throw new Error("Forbidden");
    }

    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (!existing) {
      await ctx.db.insert("favourites", {
        userId,
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
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), userId),
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

// Returns all favourites for the authenticated user, sorted most-recently-saved first.
export const getFavourites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("favourites")
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();
  },
});
