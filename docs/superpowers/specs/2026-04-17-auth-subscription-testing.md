# Auth + Subscription — Testing Document

> **Status (2026-04-18):** This doc reflects the current test state after the subscription simplification. Older entries describing the two-tier + trial system have been removed; see git history if you need them.

## Test Coverage Summary

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| Unit tests | 24 | 242 | All passing |
| Integration tests | 8 | 44 | All passing |
| **Total** | **32** | **286** | **All passing** |

Run locally with:

```bash
npm test                                    # full suite
npm run test:unit                           # unit only
npm run test:integration                    # integration only
npx vitest run --project unit <file>        # single file
```

`npx tsc --noEmit` is clean.

## Subscription-Specific Test Files

### Unit

| File | Tests | Covers |
|---|---|---|
| `tests/unit/PricingCards.test.tsx` | 8 | Single `$2.99` card renders; no trial / early-bird / two-plan language; Subscribe button redirects to Stripe URL; server-error paths (`pending_cancel`, `already_subscribed`, `past_due`, `no_user`) redirect correctly; `NEXT_PUBLIC_STRIPE_PRICE_ID` is forwarded to `createCheckoutSession` |
| `tests/unit/SettingsPage.test.tsx` | 25 | Page heading is "Subscription"; no Profile section rendered; view-switcher renders correct view per `subscriptionStatus`; Cancel/Resume optimistic UI; `already_ended` error handling; error scoping (portal errors render in Payment section, subscription errors render in Subscription section) |

### Integration

| File | Tests | Covers |
|---|---|---|
| `tests/integration/users-subscription.test.ts` | 10 | All state transitions: `none→active`, `active→active+pendingCancel`, `pendingCancel→resume`, `pendingCancel→cancelled`, `active→past_due`. `getSubscriptionSummary` query output for all five states plus unknown-user fallback |
| `tests/integration/searchUsage.test.ts` | 6 | Single-tier rate limit (100 / 5h window); approaching-limit (99), at-limit (blocked + `resetsAt`), window-boundary expiry, user-isolation, `recordSearch` round-trip |
| `tests/integration/checkout-guards.test.ts` | 11 | `createCheckoutSession` defensive branches — returns correct `{ok, reason}` for no-user, active, pending-cancel, trialing+permutations, past_due, unknown-status (allow-list rejection). Positive-path sanity: `none` and `cancelled` users pass all guards through to the Stripe call |

## Key Test Patterns

### Mocking Clerk in component tests

Any component test that exercises a signed-in state uses:

```ts
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      firstName: "Test",
      lastName: "User",
    },
    isLoaded: true,
  }),
  UserButton: () => null,
  ClerkProvider: ({ children }) => children,
  SignIn: () => null,
  SignUp: () => null,
}));
```

### Mocking Convex actions/queries with typed return shapes

`SettingsPage` tests mock the action return shape to exercise all branches:

```ts
const cancelSpy = vi.fn().mockResolvedValue({ ok: true });
const portalSpy = vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" });

vi.mock("convex/react", () => ({
  useQuery: () => mockState.user,
  useAction: (name: string) => {
    if (name === "stripe:cancelSubscription") return cancelSpy;
    if (name === "stripe:createPortalSession") return portalSpy;
    return vi.fn();
  },
}));
```

Tests flip `cancelSpy.mockResolvedValueOnce({ ok: false, reason: "already_ended" })` to exercise error paths.

### Scoping assertions to specific page sections

Error-scoping tests use Testing Library's `within()` + `closest("section")` to assert that a given error message is inside (or outside) a specific `<section>`:

```ts
function sectionByHeading(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name });
  const section = heading.closest("section");
  if (!section) throw new Error(`No section wraps heading '${name}'`);
  return section as HTMLElement;
}

// Assert portal error is in Payment section, not Subscription section
const paymentSection = sectionByHeading("Payment");
expect(within(paymentSection).getByText(/Couldn't open the billing portal/)).toBeInTheDocument();
const subSection = sectionByHeading("Subscription");
expect(within(subSection).queryByText(/Couldn't open the billing portal/)).not.toBeInTheDocument();
```

### `convex-test` for backend actions

Integration tests use `convex-test` + `schema` to exercise Convex functions in isolation. For `createCheckoutSession`, the defensive branches return before any Stripe SDK call, so we can exercise them without mocking Stripe:

```ts
const t = convexTest(schema);
await t.run(async (ctx) => { await ctx.db.insert("users", {...}); });
const result = await t.action(api.stripe.createCheckoutSession, {...});
expect(result).toEqual({ ok: false, reason: "already_subscribed", redirectTo: "/settings" });
```

For branches that DO reach Stripe (`none`/`cancelled` users), we assert the action throws (since the test env lacks `STRIPE_SECRET_KEY`) — this confirms the guards didn't reject but stops short of actually calling Stripe.

## Manual Test Plan

### Sign Up Flow
- [ ] Homepage CTA routes unauthenticated users to `/sign-up`
- [ ] Google sign-up works
- [ ] Email + password sign-up works (if enabled in Clerk dashboard)
- [ ] Email verification flow works (for email sign-up)
- [ ] After sign-up, user is redirected to `/settings`
- [ ] Fridge to Table logo visible on auth page

### `/settings` Plan Picker (fresh user, `subscriptionStatus: "none"`)
- [ ] Page heading reads "Subscription"
- [ ] Copy reads "Choose a plan to start cooking with Fridge to Table"
- [ ] Single plan card visible: `$2.99/mo` with "Subscribe" button
- [ ] NO two-plan layout, NO "First 100 users" badge, NO trial language
- [ ] Clicking "Subscribe" opens Stripe Checkout in the same tab
- [ ] Stripe Checkout shows card-only (Link disabled)
- [ ] Stripe Checkout accepts test card `4242 4242 4242 4242`
- [ ] After checkout, browser redirects to `/?checkout=success`
- [ ] Subsequent `/settings` load shows `ManageView` (Payment + Subscription sections)

### `/settings` Manage View (active user)
- [ ] Payment section shows "Card on file" with "Update card" button
- [ ] Subscription section shows Status: "Active"
- [ ] Subscription section shows "Next charge: $2.99 on [date]"
- [ ] "Cancel subscription" button visible (not Resume)
- [ ] No Plan row (single-plan app)
- [ ] No Profile section (managed via Clerk UserButton)

### Cancel Flow (Netflix-parity)
- [ ] Click "Cancel subscription" → confirmation modal
- [ ] Modal heading: "Cancel your subscription?"
- [ ] Modal body: "You'll keep access until [date]. You won't be charged again."
- [ ] NO trial-variant copy ("Cancel your free trial?")
- [ ] "Keep my subscription" button closes modal, no Stripe call
- [ ] "Yes, cancel" triggers cancel, closes modal
- [ ] Immediately after: Status reads "Cancelled — access until [date]"
- [ ] Immediately after: "Resume subscription" button replaces Cancel (optimistic UI)
- [ ] Immediately after: "Next charge" row is hidden
- [ ] After webhook arrives: UI state matches (webhook-driven truth catches up)
- [ ] App still works — subscription is still active until period end

### Resume Flow
- [ ] On pending-cancel state, click "Resume subscription"
- [ ] Immediately: button flips back to "Cancel subscription"
- [ ] Immediately: Status label reverts to "Active"
- [ ] Immediately: "Next charge" row reappears
- [ ] After webhook: state reconciled

### Update Card
- [ ] Click "Update card" → browser redirects to Stripe Customer Portal
- [ ] Stripe Portal allows adding / removing cards
- [ ] Portal "Return to" link routes back to `/settings`

### Past Due
- [ ] User with `subscriptionStatus: "past_due"` sees `PastDueView`
- [ ] Orange banner reads "Your payment didn't go through"
- [ ] "Update payment method" button opens Stripe Portal
- [ ] If portal fails, error message appears inline below the button (not elsewhere)
- [ ] No Subscription section or Cancel button visible

### Returning Cancelled User
- [ ] User with `subscriptionStatus: "cancelled"` on `/settings` sees `PlanPickerView`
- [ ] Copy reads "Welcome back. Your previous subscription has ended — pick a plan to resume cooking."
- [ ] Single `$2.99` Subscribe button visible
- [ ] Clicking Subscribe reuses the existing Stripe customer (same billing history, same payment methods)

### `/pricing` Redirect
- [ ] Visiting `/pricing` issues a `307 → /settings` redirect
- [ ] External bookmarks to `/pricing` land on `/settings` (view depends on user state)

### Paywall on Protected Routes
- [ ] Visit `/favourites`, `/my-chefs`, `/my-pantry`, `/my-shopping-list`, `/chef-results` as an unsubscribed user
- [ ] All redirect to `/settings` via `SubscriptionGuard` → `PaywallScreen`
- [ ] No inline PricingCards on the protected page (old behaviour removed)

### Server-Side Subscription Guard
- [ ] From browser devtools, run `fetch("/api/generate-recipes", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ingredients:["eggs"], filters:{cuisine:"", maxCookingTime:30, difficulty:"easy"}})})`
- [ ] As an unsubscribed user: response is `402 Payment Required`
- [ ] As a subscribed user: response is `200` with `recipeSetId`
- [ ] Homepage-driven recipe search: unsubscribed users get redirected to `/settings` on 402

### Duplicate-Subscription Guard
- [ ] Attempt to visit `/settings` as an active subscriber — `ManageView` renders, no Subscribe button exposed
- [ ] Directly invoke `createCheckoutSession` as an active user → returns `{ok: false, reason: "already_subscribed", redirectTo: "/settings"}`
- [ ] Same for pending-cancel → `pending_cancel`, past_due → `past_due`

### Clerk Manage Account Modal
- [ ] Click UserButton avatar → modal opens
- [ ] Email is read-only (no "Add email" / "Delete" buttons, per Clerk dashboard settings)
- [ ] Profile section allows editing first name, last name, avatar
- [ ] Security section: if Google-only, password option is hidden; if password enabled, "Set password" is available
- [ ] "Delete account" option is present (Clerk default — use at your own risk in prod)

### Navigation
- [ ] Logged out: "Sign in" and "Sign up" buttons in top-right nav
- [ ] Logged in: Clerk UserButton (avatar) in top-right nav + Settings gear icon
- [ ] Sidebar shows all nav links (My Chefs, Favourites, Pantry, Shopping List, Settings)
- [ ] All sidebar links work

### Edge Cases
- [ ] Refresh page after sign-in — stays authenticated
- [ ] Open new tab — Clerk session persists
- [ ] Sign out → sign back in — user data preserved
- [ ] Multiple rapid searches — rate limit enforced correctly at 100 / 5h
- [ ] Stripe webhook forwarding offline — UI shows optimistic state after Cancel/Resume, reconciles when webhook arrives
- [ ] Stale `stripeCustomerId` (Stripe test-mode cleaned up customer) — `createCheckoutSession` catches `resource_missing`, retries with email, new customer created, webhook overwrites stale ID

## Stripe Test Cards

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Card declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| 3D Secure required | `4000 0025 0000 3155` |

All test cards use any future expiry date and any 3-digit CVC.

## Known Gaps / Deferred Coverage

- **Server-side subscription guard on `analyzePhoto` and `searchChefVideos`** — Only `/api/generate-recipes` has server-side enforcement today. The other two are client-gated. Not blocking for launch; should be added when touching those paths.
- **`invoice.payment_failed` webhook does not re-read `cancelAtPeriodEnd`** — Narrow race window where a pending-cancel user whose card fails on renewal could see briefly stale UI. Self-heals on the next `customer.subscription.updated` webhook. Not blocking.
- **Integration test for `past_due → active` recovery** — Tests cover entering `past_due` but not exiting via successful payment. The webhook branch exists and is manually-testable.
- **Integration test asserting `resetsAt` exact value** in `searchUsage.test.ts` — currently asserts `not.toBeNull()`. The calculation is simple arithmetic; exact assertion is a nice-to-have.
