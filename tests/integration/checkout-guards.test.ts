import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// All five defensive branches in createCheckoutSession return BEFORE any
// Stripe SDK call, so we can exercise them with convex-test without mocking
// Stripe. These are the server-side guards that prevent duplicate subscriptions
// and surface the right redirect to the client.

describe("createCheckoutSession — defensive guards", () => {
  // Load the action module lazily so its top-level Stripe import doesn't matter
  // (we never hit a code path that uses getStripe() in these tests).
  async function seedUser(
    t: ReturnType<typeof convexTest>,
    overrides: Record<string, unknown> = {}
  ) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_test",
        email: "test@example.com",
        subscriptionStatus: "none",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
      });
    });
  }

  const ARGS_FIXTURE = {
    clerkId: "user_test",
    email: "test@example.com",
    priceId: "price_test",
  };

  test("no user record → returns { ok: false, reason: 'no_user' }", async () => {
    const t = convexTest(schema);
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({ ok: false, reason: "no_user" });
  });

  test("active subscriber + pending cancel → returns 'pending_cancel' with /settings redirect", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "pending_cancel",
      redirectTo: "/settings",
    });
  });

  test("active subscriber (no pending cancel) → returns 'already_subscribed' with /settings redirect", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    });
  });

  test("trialing subscriber (no pending cancel) → returns 'already_subscribed'", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "trialing",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    });
  });

  test("trialing subscriber + pending cancel → returns 'pending_cancel'", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "trialing",
      cancelAtPeriodEnd: true,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "pending_cancel",
      redirectTo: "/settings",
    });
  });

  test("past_due subscriber → returns 'past_due' with /settings redirect", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "past_due",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "past_due",
      redirectTo: "/settings",
    });
  });

  test("unknown Stripe status (e.g. 'incomplete') → rejected by allow-list", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "incomplete",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    // Allow-list only permits "none" and "cancelled" — everything else gets
    // routed to /settings as "already_subscribed" to prevent duplicate subs.
    expect(result).toEqual({
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    });
  });

  test("another unknown status ('incomplete_expired') → also rejected by allow-list", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "incomplete_expired",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    });
  });

  test("'unpaid' status → rejected by allow-list", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "unpaid",
      cancelAtPeriodEnd: false,
    });
    const result = await t.action(
      api.stripe.createCheckoutSession,
      ARGS_FIXTURE
    );
    expect(result).toEqual({
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    });
  });

  // Positive-path sanity: a fresh "none" user proceeds past every guard.
  // We can't assert the full happy path without mocking Stripe, but we CAN
  // assert that the guards don't reject — the error will come from Stripe
  // (missing/invalid API key) instead of { ok: false }.
  test("subscriber with 'none' status passes all guards (reaches Stripe call)", async () => {
    const t = convexTest(schema);
    await seedUser(t, { subscriptionStatus: "none" });
    // Action will throw once it tries to call Stripe without a valid key.
    // The important thing is it does NOT return a typed { ok: false } result —
    // meaning it cleared all the defensive guards.
    await expect(
      t.action(api.stripe.createCheckoutSession, ARGS_FIXTURE)
    ).rejects.toThrow();
  });

  test("subscriber with 'cancelled' status passes all guards (reaches Stripe call)", async () => {
    const t = convexTest(schema);
    await seedUser(t, { subscriptionStatus: "cancelled" });
    await expect(
      t.action(api.stripe.createCheckoutSession, ARGS_FIXTURE)
    ).rejects.toThrow();
  });
});
