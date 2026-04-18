# Subscription Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the subscription system to a single $2.99/mo plan with no free trial, credit-card-only checkout. Remove every dead code path introduced by the removed features (trial tracking, plan tiers, early-bird pricing).

**Architecture:** Keep the state machine that handles cancel-at-period-end + Resume + past-due (core subscription UX — not complexity). Delete trial logic end-to-end (schema writes, webhook branching, checkout config, UI copy, tests). Delete two-tier plan logic (Basic/Chef distinction, early-bird counter, first-100 badge). Collapse multi-price env vars to `NEXT_PUBLIC_STRIPE_PRICE_ID`. Schema fields `hasUsedChefTrial` and `trialEndsAt` stay as deprecated optional fields so existing Convex docs still validate, but no code reads or writes them.

**Tech Stack:** Next.js 16, Convex, Stripe SDK v22, Clerk v7, Tailwind, Vitest, Testing Library.

---

## File Structure

**Modify:**
- `convex/stripe.ts` — `createCheckoutSession` loses `plan` arg and all trial/plan config
- `convex/stripeWebhook.ts` — remove `usedChefTrial` computation, plan-metadata extraction stays only for back-compat on existing subs
- `convex/users.ts` — delete `getChefSubscriberCount`; simplify `getSubscriptionSummary` (drop `chefTrialEligible`); simplify `updateSubscription` (drop `plan`, `hasUsedChefTrial`, `trialEndsAt` args)
- `components/PricingCards.tsx` — rewrite as a single card, `$2.99/mo`, plain "Subscribe" CTA
- `app/settings/page.tsx` — remove `planLabel`/`planPrice`/`statusLabel trialing branch`, trial cancel-copy variant, plan display row
- `components/HomePage.tsx` — verify no plan-specific branching (CTA already points to `/settings`)
- `.env.example` — replace three price vars with one

**Keep unchanged:**
- `convex/schema.ts` — `plan`, `hasUsedChefTrial`, `trialEndsAt` stay as optional deprecated fields (back-compat with existing docs)
- `components/SubscriptionGuard.tsx`
- `components/PaywallScreen.tsx`
- `app/pricing/page.tsx` (still redirects to `/settings`)
- `middleware.ts`
- Cancel confirmation modal structure (just the copy simplifies)
- Past-due view
- Resume subscription flow

**Tests to update:**
- `tests/unit/PricingCards.test.tsx` — rewrite for single-card layout
- `tests/unit/SettingsPage.test.tsx` — remove trialing-state tests, remove trial-variant cancel-copy test
- `tests/integration/users-subscription.test.ts` — remove trial-flag tests, remove chef-counter test, update `getSubscriptionSummary` tests

---

## Task 1: Simplify PricingCards to single-card layout

**Files:**
- Modify: `components/PricingCards.tsx`
- Test: `tests/unit/PricingCards.test.tsx`

- [ ] **Step 1: Rewrite the failing tests for single-card**

Replace the entire test file with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PricingCards } from "@/components/PricingCards";

const mockState: {
  checkoutResult:
    | { ok: true; url: string }
    | {
        ok: false;
        reason: "already_subscribed" | "pending_cancel" | "past_due" | "no_user";
        redirectTo?: string;
      };
} = {
  checkoutResult: { ok: true, url: "https://checkout.stripe.com/test" },
};

const checkoutSpy = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
    isLoaded: true,
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    stripe: { createCheckoutSession: "stripe:createCheckoutSession" },
  },
}));

vi.mock("convex/react", () => ({
  useAction: () => checkoutSpy,
}));

const locationHrefSetter = vi.fn();
Object.defineProperty(window, "location", {
  value: { href: "", assign: vi.fn() },
  writable: true,
});
Object.defineProperty(window.location, "href", {
  set: locationHrefSetter,
  get: () => "",
});

describe("PricingCards — single plan", () => {
  beforeEach(() => {
    mockState.checkoutResult = { ok: true, url: "https://checkout.stripe.com/test" };
    checkoutSpy.mockReset();
    checkoutSpy.mockImplementation(() => Promise.resolve(mockState.checkoutResult));
    locationHrefSetter.mockReset();
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID = "price_test";
  });

  it("shows a single plan card with $2.99/mo and a Subscribe button", () => {
    render(<PricingCards />);
    expect(screen.getByText("$2.99")).toBeInTheDocument();
    expect(screen.getByText(/\/mo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subscribe/i })).toBeInTheDocument();
  });

  it("does NOT show trial, early-bird, or two-plan language", () => {
    render(<PricingCards />);
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/7-day/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/First 100/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Basic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chef plan/i)).not.toBeInTheDocument();
  });

  it("clicking Subscribe redirects to Stripe checkout URL", async () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("https://checkout.stripe.com/test");
    });
  });

  it("calls createCheckoutSession with the configured price ID (no plan arg)", async () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalledWith({
        clerkId: "user_test",
        email: "test@example.com",
        priceId: "price_test",
      });
    });
  });

  it("redirects to /settings if server returns already_subscribed", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("redirects to /settings if server returns pending_cancel", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "pending_cancel",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("redirects to /settings if server returns past_due", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "past_due",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("shows friendly error if server returns no_user", async () => {
    mockState.checkoutResult = { ok: false, reason: "no_user" };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    expect(await screen.findByText(/We couldn't start checkout/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — they must fail**

Run: `npx vitest run --project unit tests/unit/PricingCards.test.tsx`
Expected: FAIL — old PricingCards renders two cards, has trial copy.

- [ ] **Step 3: Rewrite PricingCards.tsx**

Replace the file contents with:

```tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function PricingCards() {
  const { user } = useUser();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (!user) return;
    setCheckoutError(null);
    setLoading(true);

    try {
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;
      const result = await createCheckout({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        priceId,
      });

      if (result.ok) {
        window.location.href = result.url;
        return;
      }

      if (
        result.reason === "pending_cancel" ||
        result.reason === "already_subscribed" ||
        result.reason === "past_due"
      ) {
        window.location.href = result.redirectTo ?? "/settings";
        return;
      }

      setCheckoutError("We couldn't start checkout. Please try again.");
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutError("We couldn't start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border-2 border-[#1A3A2A] p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Subscription</h3>
        <p className="text-3xl font-bold text-gray-900 mb-4">
          $2.99<span className="text-base font-normal text-gray-500">/mo</span>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Everything you need to cook with what&apos;s on hand.
        </p>

        <ul className="space-y-3 mb-6">
          {[
            "Recipe search with your ingredients",
            "Chef's Table video results",
            "Photo scan",
            "Pantry + shopping list",
            "Save favourite recipes",
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">
                &#10003;
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#1A3A2A] text-white text-sm font-medium hover:bg-[#2a5a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? "Loading..." : "Subscribe"}
          {!loading && <span className="text-xs">&#8599;</span>}
        </button>

        {checkoutError && (
          <p className="text-center text-sm text-red-500 mt-4">{checkoutError}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — they must pass**

Run: `npx vitest run --project unit tests/unit/PricingCards.test.tsx`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add components/PricingCards.tsx tests/unit/PricingCards.test.tsx
git commit -m "feat(subscription): collapse PricingCards to single \$2.99 plan"
```

---

## Task 2: Simplify createCheckoutSession (remove plan + trial args)

**Files:**
- Modify: `convex/stripe.ts`

- [ ] **Step 1: Update the checkout action**

In `convex/stripe.ts`, replace the `createCheckoutSession` action with:

```ts
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
```

- [ ] **Step 2: Wait for Convex to push the change**

Run: `sleep 6 && tail -3 <convex-dev-log>`
Expected: "Convex functions ready!"

- [ ] **Step 3: Run full test suite to catch callers**

Run: `npm test`
Expected: FAIL on SettingsPage tests that call createCheckoutSession mock with a `plan` arg (old contract); also possibly integration tests that seed `plan` field.

- [ ] **Step 4: Commit**

```bash
git add convex/stripe.ts
git commit -m "refactor(stripe): drop plan + trial args from createCheckoutSession"
```

---

## Task 3: Simplify webhook (remove plan + trial writes)

**Files:**
- Modify: `convex/stripeWebhook.ts`

- [ ] **Step 1: Rewrite the webhook**

Replace the file contents with:

```ts
"use node";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

function getPeriodEnd(subscription: Stripe.Subscription): number | undefined {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  if (itemEnd) return itemEnd * 1000;
  const raw = subscription as unknown as Record<string, unknown>;
  if (typeof raw.current_period_end === "number") return (raw.current_period_end as number) * 1000;
  return undefined;
}

function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  if (stripeStatus === "trialing") return "trialing";
  if (stripeStatus === "active") return "active";
  if (stripeStatus === "past_due") return "past_due";
  if (stripeStatus === "canceled") return "cancelled";
  return stripeStatus;
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
              stripePriceId: subscription.items.data[0]?.price.id,
              subscriptionStatus: mapStatus(subscription.status),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodEnd: getPeriodEnd(subscription),
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: subscription.items.data[0]?.price.id,
          subscriptionStatus: mapStatus(subscription.status),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodEnd: getPeriodEnd(subscription),
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          subscriptionStatus: "cancelled",
          cancelAtPeriodEnd: false,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : invoice.customer?.id;

        const raw = invoice as unknown as Record<string, unknown>;
        const subscriptionId =
          (typeof raw.subscription === "string" ? raw.subscription : null) ??
          (invoice.parent?.subscription_details?.subscription as string | undefined);

        if (customerId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: customerId,
            subscriptionStatus: mapStatus(subscription.status),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
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
```

- [ ] **Step 2: Commit**

```bash
git add convex/stripeWebhook.ts
git commit -m "refactor(webhook): stop writing plan/trial fields"
```

---

## Task 4: Simplify users.ts (remove chef counter, simplify queries)

**Files:**
- Modify: `convex/users.ts`

- [ ] **Step 1: Update users.ts**

Replace `getSubscriptionSummary`, `getChefSubscriberCount`, and `updateSubscription` — delete the counter, drop trial/plan fields from the others. Final shape:

```ts
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
      console.error(
        "[updateSubscription] No user found for Stripe customer:",
        args.stripeCustomerId
      );
      return;
    }

    await ctx.db.patch(user._id, {
      stripeSubscriptionId:
        args.stripeSubscriptionId ?? user.stripeSubscriptionId,
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
```

Delete `getChefSubscriberCount` entirely.

- [ ] **Step 2: Commit**

```bash
git add convex/users.ts
git commit -m "refactor(users): drop chef counter + plan/trial writes"
```

---

## Task 5: Simplify settings page

**Files:**
- Modify: `app/settings/page.tsx`

- [ ] **Step 1: Update settings page**

In `ManageView`:
- Remove `planLabel` and `planPrice` constants
- Remove the "Plan" row from the Subscription section
- Remove the `"trialing"` branch from `statusLabel` (fall through to default → "Active")
- Remove the `isTrial` branch from the Cancel confirmation modal — always use paid-variant copy
- Remove `planLabel` references in cancel copy (replace with "your subscription")

In `PastDueView`:
- Remove `planLabel` constant
- Update copy: "We couldn't charge your card. Update your payment method to keep access."

Final `statusLabel`:
```ts
const statusLabel = pendingCancel
  ? `Cancelled — access until ${nextBillingDate ?? "period end"}`
  : dbUser.subscriptionStatus === "active" || dbUser.subscriptionStatus === "trialing"
    ? "Active"
    : dbUser.subscriptionStatus;
```

Final Cancel-confirmation body:
```tsx
<h2 className="text-xl font-bold text-[#1A3A2A] mb-4">
  Cancel your subscription?
</h2>
<p className="text-gray-500 mb-2">
  You&apos;ll keep access until <strong>{endDate}</strong>. You won&apos;t be
  charged again.
</p>
<p className="text-gray-400 text-sm mb-8">
  Your recipes, pantry, and favourites will be saved.
</p>
```

Final Next-charge row:
```tsx
{nextBillingDate && !pendingCancel && (
  <div className="flex items-center justify-between">
    <p className="text-sm text-gray-700">Next charge</p>
    <p className="text-sm text-gray-900">$2.99 on {nextBillingDate}</p>
  </div>
)}
```

Remove the "Plan" row entirely.

- [ ] **Step 2: Commit**

```bash
git add app/settings/page.tsx
git commit -m "refactor(settings): drop plan tiers + trial-variant cancel copy"
```

---

## Task 6: Update SettingsPage tests

**Files:**
- Modify: `tests/unit/SettingsPage.test.tsx`

- [ ] **Step 1: Update tests for no-trial world**

- Delete the entire "Trialing (no pending cancel)" describe block
- Rename "Trialing + pending cancel" → "Active + pending cancel (pre-existing behavior)"; set `subscriptionStatus: "active"` throughout
- Delete the "cancel confirmation shows trial-variant copy" test from the Active section (or change expected copy to paid-variant — it already uses paid-variant in Active tests, so just remove the trial variant assertion)
- Keep Active (no pending cancel), Active + pending cancel, Cancelled, No-sub, Past-due, Stripe-error sections
- Update `baseUser` default: `subscriptionStatus: "active"` (was "trialing"), remove `trialEndsAt` from fixture

Specifically delete these tests:
- `shows Trial status label with end date`
- `cancel confirmation shows trial-variant copy`

And rename test headings that reference "Trialing" to "Active".

- [ ] **Step 2: Run tests — they must pass**

Run: `npx vitest run --project unit tests/unit/SettingsPage.test.tsx`
Expected: PASS — all remaining tests green.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/SettingsPage.test.tsx
git commit -m "test(settings): remove trialing-state assertions"
```

---

## Task 7: Update integration tests

**Files:**
- Modify: `tests/integration/users-subscription.test.ts`

- [ ] **Step 1: Delete trial-related tests**

Delete these tests entirely:
- `hasUsedChefTrial is monotonic — once true, stays true`
- `hasUsedChefTrial gets set when webhook reports Chef trial`
- `Chef subscriber counter excludes cancelled and past_due` (counter is gone)

- [ ] **Step 2: Update `getSubscriptionSummary` tests**

Remove `chefTrialEligible` assertions from all remaining summary tests. Example:

```ts
test("getSubscriptionSummary — fresh user", async () => {
  const t = convexTest(schema);
  await seedUser(t);
  const summary = await t.query(api.users.getSubscriptionSummary, {
    clerkId: "user_test",
  });
  expect(summary.hasActiveSub).toBe(false);
  expect(summary.pendingCancel).toBe(false);
});
```

Keep the active-sub, pending-cancel, past-due, cancelled-returning, and unknown-clerkId summary tests — just drop the `chefTrialEligible` lines.

- [ ] **Step 3: Update transition tests**

Remove `hasUsedChefTrial` from all `seedUser` calls and `updateSubscription` calls. Remove the `plan: "chef"` field from seedUser calls (optional anyway). Keep all state-transition assertions (they're orthogonal to trial/plan).

- [ ] **Step 4: Run tests**

Run: `npx vitest run --project integration tests/integration/users-subscription.test.ts`
Expected: PASS — all remaining tests green.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/users-subscription.test.ts
git commit -m "test(users): drop trial-flag + chef-counter tests"
```

---

## Task 8: Verify HomePage has no plan-specific code

**Files:**
- Modify: `components/HomePage.tsx` (only if needed)

- [ ] **Step 1: Grep for plan references**

Run: `grep -n "plan\|basic\|chef" components/HomePage.tsx`

Expected: references to `hasActiveSubscription` (subscription gating) are fine. Any branching on plan values (`dbUser.plan === "chef"`) must be removed.

- [ ] **Step 2: If plan-specific branches found, replace with single-plan fallthrough**

Otherwise skip.

- [ ] **Step 3: Commit if changes made**

```bash
git add components/HomePage.tsx
git commit -m "refactor(homepage): drop plan-specific branches"
```

---

## Task 9: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Read current file**

Run: `cat .env.example`
Expected: shows three Stripe price IDs.

- [ ] **Step 2: Replace with single price ID**

Replace the three `NEXT_PUBLIC_STRIPE_*_PRICE_ID` lines with:

```
# Stripe Price ID for the subscription (create a $2.99/mo recurring price in Stripe)
NEXT_PUBLIC_STRIPE_PRICE_ID=
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(env): consolidate to single stripe price id"
```

---

## Task 10: Final verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests pass; number should be lower than before (trial tests removed).

- [ ] **Step 3: Dev server sanity**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/settings`
Also check Next.js log for `✓ Compiled` with no errors.

- [ ] **Step 4: Dead-code grep**

```bash
grep -rn "hasUsedChefTrial\|chefTrialEligible\|getChefSubscriberCount\|NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID\|NEXT_PUBLIC_STRIPE_CHEF_EARLY_PRICE_ID\|NEXT_PUBLIC_STRIPE_CHEF_STANDARD_PRICE_ID\|isEarlyBird\|First 100" --include="*.ts" --include="*.tsx" app components convex 2>/dev/null
```

Expected: zero results (all dead references gone).

- [ ] **Step 5: Confirm state in Stripe dashboard**

Remind the user they need to:
1. Create a $2.99/mo recurring Price in Stripe Dashboard
2. Set `NEXT_PUBLIC_STRIPE_PRICE_ID` in `.env.local` to that Price ID
3. Disable the Link payment method in Stripe Dashboard → Settings → Payment methods (if they don't want it appearing in Checkout)

---

## Self-Review

**Spec coverage:**
- Single $2.99/mo plan → Task 1 (UI), Task 2 (checkout), Task 9 (env)
- No free trial → Task 1 (UI copy removed), Task 2 (no trial_period_days), Task 3 (webhook drops trial fields), Task 5 (no trial status label, no trial cancel variant)
- Credit card only → Task 2 keeps `payment_method_types: ["card"]`; Task 10 step 5 instructs user to turn off Link in dashboard
- Remove dead code → Tasks 1, 4 (counter), 5 (plan labels), 6, 7, 8, 9 (env), 10 step 4 (grep check)
- Don't touch unrelated functionality → Plan scope limited to subscription files

**Placeholder scan:** No TBDs, all code shown in full.

**Type consistency:** `CheckoutResult` type unchanged across Tasks 1, 2, 6, 7. `getSubscriptionSummary` return shape consistent between Tasks 4 and 7.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-18-subscription-simplification.md`.**

Because this plan is in the same session that produced it — and the user asked for self-verification at each step — I'll execute **inline** using the executing-plans skill, batching the 10 tasks with checkpoint verification (tsc + tests) after each significant change.
