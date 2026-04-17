import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    // Delegate to Node.js action for Stripe SDK operations
    try {
      await ctx.runAction(internal.stripeWebhook.handleWebhookEvent, {
        body,
        signature: sig,
      });
    } catch (err) {
      console.error("[stripe-webhook] Error processing event:", err);
      return new Response("Webhook processing failed", { status: 500 });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
