import { query, mutation, action } from "./_generated/server";
import { parseYouTubeInput } from "../lib/parseYouTubeUrl";
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

// ─── resolveYouTubeChannel ─────────────────────────────────────────────────

export const resolveYouTubeChannel = action({
  args: { input: v.string() },
  handler: async (_ctx, args) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "api_error" as const };
    }

    const parsed = parseYouTubeInput(args.input);
    if (parsed.type === "error") {
      return { ok: false as const, error: "parse_error" as const };
    }

    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/channels");
      url.searchParams.set("key", apiKey);
      url.searchParams.set("part", "snippet");

      if (parsed.type === "handle") {
        url.searchParams.set("forHandle", parsed.value);
      } else {
        url.searchParams.set("id", parsed.value);
      }

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.error || !data.items?.length) {
        return { ok: false as const, error: "not_found" as const };
      }

      const channel = data.items[0];
      return {
        ok: true as const,
        channelId: channel.id as string,
        channelName: channel.snippet.title as string,
        channelThumbnail: channel.snippet.thumbnails.default.url as string,
        resolvedAt: Date.now(),
      };
    } catch {
      return { ok: false as const, error: "api_error" as const };
    }
  },
});
