import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

// ─── listCustomChefs ───────────────────────────────────────────────────────

export const listCustomChefs = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!doc) return [];
    return [...doc.chefs].sort((a, b) => a.addedAt - b.addedAt);
  },
});
