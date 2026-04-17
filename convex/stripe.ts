"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-03-25.dahlia",
});

export const createCheckoutSession = action({
  args: {
    clerkId: v.string(),
    email: v.string(),
    priceId: v.string(),
    plan: v.union(v.literal("basic"), v.literal("chef")),
  },
  handler: async (_ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: args.email,
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        clerkId: args.clerkId,
        plan: args.plan,
      },
    };

    // Chef plan gets 7-day free trial
    if (args.plan === "chef") {
      sessionConfig.subscription_data = {
        trial_period_days: 7,
        metadata: {
          clerkId: args.clerkId,
          plan: args.plan,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { url: session.url };
  },
});

// Create a Stripe Customer Portal session for managing payment methods
export const createPortalSession = action({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (_ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: args.stripeCustomerId,
      return_url: `${baseUrl}/settings`,
    });
    return { url: session.url };
  },
});

// Cancel subscription at period end
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (_ctx, args) => {
    await stripe.subscriptions.update(args.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  },
});
