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

// ─── addCustomChef ─────────────────────────────────────────────────────────

const MAX_CHEFS = 6;

export const addCustomChef = mutation({
  args: {
    sessionId: v.string(),
    channelId: v.string(),
    channelName: v.string(),
    channelThumbnail: v.string(),
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    const newChef = {
      channelId: args.channelId,
      channelName: args.channelName,
      channelThumbnail: args.channelThumbnail,
      addedAt: Date.now(),
      resolvedAt: args.resolvedAt,
    };

    if (!doc) {
      await ctx.db.insert("customChefs", {
        sessionId: args.sessionId,
        chefs: [newChef],
        updatedAt: Date.now(),
      });
      return;
    }

    if (doc.chefs.length >= MAX_CHEFS) {
      throw new Error("limit_reached");
    }

    if (doc.chefs.some((c) => c.channelId === args.channelId)) {
      throw new Error("duplicate");
    }

    await ctx.db.patch(doc._id, {
      chefs: [...doc.chefs, newChef],
      updatedAt: Date.now(),
    });
  },
});

// ─── removeCustomChef ──────────────────────────────────────────────────────

export const removeCustomChef = mutation({
  args: {
    sessionId: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!doc) return;

    const filtered = doc.chefs.filter((c) => c.channelId !== args.channelId);
    if (filtered.length === doc.chefs.length) return;
    await ctx.db.patch(doc._id, {
      chefs: filtered,
      updatedAt: Date.now(),
    });
  },
});
