import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return new Response("Webhook signature verification failed", { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerkId;
        const plan = session.metadata?.plan as "basic" | "chef" | undefined;

        if (clerkId && session.customer) {
          // Link Stripe customer to our user
          await ctx.runMutation(internal.users.setStripeCustomerId, {
            clerkId,
            stripeCustomerId: session.customer as string,
          });

          // Retrieve subscription details
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
              currentPeriodEnd: subscription.current_period_end * 1000,
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
          currentPeriodEnd: subscription.current_period_end * 1000,
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
        if (invoice.customer && invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: invoice.customer as string,
            subscriptionStatus: "active",
            currentPeriodEnd: subscription.current_period_end * 1000,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: invoice.customer as string,
            subscriptionStatus: "past_due",
          });
        }
        break;
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
