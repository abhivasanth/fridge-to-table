import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Saves a video to the user's favourites list.
// Silently ignores duplicate saves (idempotent).
export const saveVideoFavourite = mutation({
  args: {
    sessionId: v.string(),
    videoId: v.string(),
    title: v.string(),
    thumbnail: v.string(),
    channelId: v.string(),
    channelName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoFavourites")
      .withIndex("by_session_and_video", (q) =>
        q.eq("sessionId", args.sessionId).eq("videoId", args.videoId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("videoFavourites", {
        sessionId: args.sessionId,
        videoId: args.videoId,
        title: args.title,
        thumbnail: args.thumbnail,
        channelId: args.channelId,
        channelName: args.channelName,
        savedAt: Date.now(),
      });
    }
  },
});

// Removes a video from the user's favourites list.
// Silently ignores if the entry doesn't exist.
export const removeVideoFavourite = mutation({
  args: {
    sessionId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoFavourites")
      .withIndex("by_session_and_video", (q) =>
        q.eq("sessionId", args.sessionId).eq("videoId", args.videoId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Returns all video favourites for a session, sorted most-recently-saved first.
export const getVideoFavourites = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoFavourites")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});
