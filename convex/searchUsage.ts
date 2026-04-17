// convex/searchUsage.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_SEARCHES = 20;
const WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

// Check if user can search — returns { allowed, remaining, resetsAt }
export const checkLimit = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - WINDOW_MS;
    const recent = await ctx.db
      .query("searchUsage")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", args.userId).gte("searchedAt", cutoff)
      )
      .collect();

    const count = recent.length;
    const allowed = count < MAX_SEARCHES;
    const remaining = Math.max(0, MAX_SEARCHES - count);

    // Find when the oldest search in the window expires
    let resetsAt: number | null = null;
    if (!allowed && recent.length > 0) {
      const oldest = recent.reduce((min, r) =>
        r.searchedAt < min.searchedAt ? r : min
      );
      resetsAt = oldest.searchedAt + WINDOW_MS;
    }

    return { allowed, remaining, resetsAt, used: count };
  },
});

// Record a search — called after successful recipe generation
export const recordSearch = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("searchUsage", {
      userId: args.userId,
      searchedAt: Date.now(),
    });
  },
});
