// convex/users.ts
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get user by Clerk ID — used by components to check subscription status
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get or create user — called after Clerk sign-up/sign-in
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Update profile fields if changed
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      subscriptionStatus: "none",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Subscription state summary — drives PricingCards + guards
export const getSubscriptionSummary = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) {
      return {
        hasRecord: false,
        hasActiveSub: false,
        pendingCancel: false,
        subscriptionStatus: "none",
      };
    }
    const hasActiveSub =
      user.subscriptionStatus === "trialing" ||
      user.subscriptionStatus === "active";
    return {
      hasRecord: true,
      hasActiveSub,
      pendingCancel: user.cancelAtPeriodEnd === true,
      subscriptionStatus: user.subscriptionStatus,
    };
  },
});

// Update subscription status — called by Stripe webhook handler
export const updateSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    stripePriceId: v.optional(v.string()),
    subscriptionStatus: v.string(),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer_id", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .unique();

    if (!user) {
      console.error("[updateSubscription] No user found for Stripe customer:", args.stripeCustomerId);
      return;
    }

    await ctx.db.patch(user._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? user.stripeSubscriptionId,
      stripePriceId: args.stripePriceId ?? user.stripePriceId,
      subscriptionStatus: args.subscriptionStatus,
      cancelAtPeriodEnd:
        args.cancelAtPeriodEnd !== undefined
          ? args.cancelAtPeriodEnd
          : user.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd ?? user.currentPeriodEnd,
      updatedAt: Date.now(),
    });
  },
});

// Set Stripe customer ID — called after Checkout session completion
export const setStripeCustomerId = internalMutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      console.error("[setStripeCustomerId] No user found for Clerk ID:", args.clerkId);
      return;
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

