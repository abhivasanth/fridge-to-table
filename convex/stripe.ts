"use node";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

type CheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      reason: "already_subscribed" | "pending_cancel" | "past_due" | "no_user";
      redirectTo?: string;
    };

export const createCheckoutSession = action({
  args: {
    clerkId: v.string(),
    email: v.string(),
    priceId: v.string(),
  },
  handler: async (ctx, args): Promise<CheckoutResult> => {
    // Defensive: look up user truth from Convex, don't trust client claims
    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: args.clerkId,
    });
    if (!user) {
      return { ok: false, reason: "no_user" };
    }

    const hasActiveSub =
      user.subscriptionStatus === "trialing" ||
      user.subscriptionStatus === "active";

    if (hasActiveSub && user.cancelAtPeriodEnd === true) {
      return { ok: false, reason: "pending_cancel", redirectTo: "/settings" };
    }
    if (hasActiveSub) {
      return { ok: false, reason: "already_subscribed", redirectTo: "/settings" };
    }
    if (user.subscriptionStatus === "past_due") {
      return { ok: false, reason: "past_due", redirectTo: "/settings" };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const baseConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/settings`,
      metadata: { clerkId: args.clerkId },
      subscription_data: { metadata: { clerkId: args.clerkId } },
    };

    const stripe = getStripe();
    const createWithCustomer = async () =>
      stripe.checkout.sessions.create({
        ...baseConfig,
        customer: user.stripeCustomerId!,
      });
    const createWithEmail = async () =>
      stripe.checkout.sessions.create({
        ...baseConfig,
        customer_email: args.email,
      });

    // Reuse existing Stripe customer so trial history and payment methods carry
    // over. If the stored customer ID is stale (e.g. Stripe test-mode cleaned it
    // up), retry with email — the webhook will overwrite the stale ID on
    // successful completion.
    let session: Stripe.Checkout.Session;
    if (user.stripeCustomerId) {
      try {
        session = await createWithCustomer();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/No such customer/i.test(message)) {
          console.warn(
            "[createCheckoutSession] Stale stripeCustomerId, retrying with email",
            { clerkId: args.clerkId, staleCustomerId: user.stripeCustomerId }
          );
          session = await createWithEmail();
        } else {
          throw err;
        }
      }
    } else {
      session = await createWithEmail();
    }

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL");
    }
    return { ok: true, url: session.url };
  },
});

// Create a Stripe Customer Portal session for managing payment methods
export const createPortalSession = action({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (_ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await getStripe().billingPortal.sessions.create({
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
  handler: async (
    _ctx,
    args
  ): Promise<{ ok: true } | { ok: false; reason: "already_ended" | "unknown" }> => {
    try {
      await getStripe().subscriptions.update(args.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Stripe refuses to update subscriptions in a terminal state.
      if (/incomplete_expired|canceled/i.test(message)) {
        return { ok: false, reason: "already_ended" };
      }
      console.error("[cancelSubscription]", message);
      return { ok: false, reason: "unknown" };
    }
  },
});

// Resume a subscription that is scheduled to cancel at period end
export const resumeSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (
    _ctx,
    args
  ): Promise<{ ok: true } | { ok: false; reason: "already_ended" | "unknown" }> => {
    try {
      await getStripe().subscriptions.update(args.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/incomplete_expired|canceled/i.test(message)) {
        return { ok: false, reason: "already_ended" };
      }
      console.error("[resumeSubscription]", message);
      return { ok: false, reason: "unknown" };
    }
  },
});
