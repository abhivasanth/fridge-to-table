import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { internal, api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("updateSubscription — subscription state transitions", () => {
  async function seedUser(t: ReturnType<typeof convexTest>, overrides = {}) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_test",
        email: "test@example.com",
        stripeCustomerId: "cus_test",
        subscriptionStatus: "none",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
      });
    });
  }

  async function readUser(t: ReturnType<typeof convexTest>) {
    return await t.query(api.users.getByClerkId, { clerkId: "user_test" });
  }

  test("transition 1: no subscription → active (fresh checkout)", async () => {
    const t = convexTest(schema);
    await seedUser(t);

    await t.mutation(internal.users.updateSubscription, {
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1779612045000,
    });

    const user = await readUser(t);
    expect(user?.subscriptionStatus).toBe("active");
    expect(user?.cancelAtPeriodEnd).toBe(false);
  });

  test("transition 2: active + cancel → active + cancelAtPeriodEnd=true (access retained)", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1779612045000,
    });

    await t.mutation(internal.users.updateSubscription, {
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: 1779612045000,
    });

    const user = await readUser(t);
    expect(user?.subscriptionStatus).toBe("active");
    expect(user?.cancelAtPeriodEnd).toBe(true);
  });

  test("transition 3: pending cancel → resume (cancelAtPeriodEnd flips back to false)", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: 1779612045000,
    });

    await t.mutation(internal.users.updateSubscription, {
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1779612045000,
    });

    const user = await readUser(t);
    expect(user?.subscriptionStatus).toBe("active");
    expect(user?.cancelAtPeriodEnd).toBe(false);
  });

  test("transition 4: pending cancel → truly cancelled at period end", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: 1779612045000,
    });

    // customer.subscription.deleted fires
    await t.mutation(internal.users.updateSubscription, {
      stripeCustomerId: "cus_test",
      subscriptionStatus: "cancelled",
      cancelAtPeriodEnd: false,
    });

    const user = await readUser(t);
    expect(user?.subscriptionStatus).toBe("cancelled");
    expect(user?.cancelAtPeriodEnd).toBe(false);
  });

  test("transition 5: payment failed → past_due", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      stripeSubscriptionId: "sub_test",
      subscriptionStatus: "active",
      cancelAtPeriodEnd: false,
      currentPeriodEnd: 1779612045000,
    });

    await t.mutation(internal.users.updateSubscription, {
      stripeCustomerId: "cus_test",
      subscriptionStatus: "past_due",
    });

    const user = await readUser(t);
    expect(user?.subscriptionStatus).toBe("past_due");
    expect(user?.cancelAtPeriodEnd).toBe(false);
  });

  test("getSubscriptionSummary — fresh user", async () => {
    const t = convexTest(schema);
    await seedUser(t);
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_test",
    });
    expect(summary.hasActiveSub).toBe(false);
    expect(summary.pendingCancel).toBe(false);
  });

  test("getSubscriptionSummary — active user", async () => {
    const t = convexTest(schema);
    await seedUser(t, { subscriptionStatus: "active" });
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_test",
    });
    expect(summary.hasActiveSub).toBe(true);
    expect(summary.pendingCancel).toBe(false);
  });

  test("getSubscriptionSummary — pending-cancel user flagged accordingly", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "active",
      cancelAtPeriodEnd: true,
    });
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_test",
    });
    expect(summary.hasActiveSub).toBe(true);
    expect(summary.pendingCancel).toBe(true);
  });

  test("getSubscriptionSummary — past_due user has no active sub", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "past_due",
      cancelAtPeriodEnd: false,
    });
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_test",
    });
    expect(summary.hasActiveSub).toBe(false);
    expect(summary.subscriptionStatus).toBe("past_due");
  });

  test("getSubscriptionSummary — cancelled user has no active sub", async () => {
    const t = convexTest(schema);
    await seedUser(t, {
      subscriptionStatus: "cancelled",
      cancelAtPeriodEnd: false,
    });
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_test",
    });
    expect(summary.hasActiveSub).toBe(false);
  });

  test("getSubscriptionSummary — unknown clerkId returns default hasActiveSub=false", async () => {
    const t = convexTest(schema);
    const summary = await t.query(api.users.getSubscriptionSummary, {
      clerkId: "user_nonexistent",
    });
    expect(summary.hasRecord).toBe(false);
    expect(summary.hasActiveSub).toBe(false);
  });
});
