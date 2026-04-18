// convex/users.ts
import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireUserId } from "./auth";

// Internal: look up a user by Clerk ID. Not exposed publicly — doing so would
// let any authenticated caller enumerate any other user's row. Use
// `getCurrentUser` for the public, auth-scoped variant.
export const getByClerkId = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Public: return the currently-authenticated user's row (or null if no row
// exists yet — the UserSync effect creates it on first sign-in).
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const clerkId = await requireUserId(ctx);
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

// Get-or-create on sign-in. The clerkId is ALWAYS derived from the authenticated
// JWT — clients cannot create or update another user's row.
export const getOrCreateUser = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const clerkId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
