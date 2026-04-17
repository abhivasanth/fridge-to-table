"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

// Extract current_period_end from subscription — in Stripe SDK v22,
// this lives on SubscriptionItem, not Subscription directly.
function getPeriodEnd(subscription: Stripe.Subscription): number | undefined {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  if (itemEnd) return itemEnd * 1000;
  // Fallback: the raw API response may still include it at the top level
  const raw = subscription as unknown as Record<string, unknown>;
  if (typeof raw.current_period_end === "number") return (raw.current_period_end as number) * 1000;
  return undefined;
}

export const handleWebhookEvent = internalAction({
  args: {
    body: v.string(),
    signature: v.string(),
  },
  handler: async (ctx, args) => {
    const stripe = getStripe();

    const event = stripe.webhooks.constructEvent(
      args.body,
      args.signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerkId;
        const plan = session.metadata?.plan as "basic" | "chef" | undefined;

        if (clerkId && session.customer) {
          await ctx.runMutation(internal.users.setStripeCustomerId, {
            clerkId,
            stripeCustomerId: session.customer as string,
          });

          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            await ctx.runMutation(internal.users.updateSubscription, {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              plan: plan ?? "basic",
              stripePriceId: subscription.items.data[0]?.price.id,
              subscriptionStatus: subscription.status === "trialing" ? "trialing" : "active",
              trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
              currentPeriodEnd: getPeriodEnd(subscription),
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = subscription.metadata?.plan as "basic" | "chef" | undefined;

        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          plan,
          stripePriceId: subscription.items.data[0]?.price.id,
          subscriptionStatus: subscription.cancel_at_period_end
            ? "cancelled"
            : subscription.status === "trialing"
              ? "trialing"
              : subscription.status === "active"
                ? "active"
                : subscription.status,
          trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
          currentPeriodEnd: getPeriodEnd(subscription),
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          subscriptionStatus: "cancelled",
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        // Extract subscription ID from invoice — v22 moved this to parent.subscription_details
        const raw = invoice as unknown as Record<string, unknown>;
        const subscriptionId =
          (typeof raw.subscription === "string" ? raw.subscription : null) ??
          (invoice.parent?.subscription_details?.subscription as string | undefined);

        if (customerId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: customerId,
            subscriptionStatus: "active",
            currentPeriodEnd: getPeriodEnd(subscription),
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: customerId,
            subscriptionStatus: "past_due",
          });
        }
        break;
      }
    }
  },
});
