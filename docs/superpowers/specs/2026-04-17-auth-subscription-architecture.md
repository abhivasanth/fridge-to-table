# Auth + Subscription — Architecture Document

> **Status (2026-04-18):** This doc reflects the current state after the subscription simplification. See `2026-04-17-auth-subscription-decisions.md` (especially Decisions 17-27) for how we got here.

## System Architecture

```
                         +-----------------+
                         |   User Browser  |
                         +--------+--------+
                                  |
                    +-------------+-------------+
                    |                           |
              +-----v------+            +------v------+
              | Clerk Auth |            | Stripe      |
              |  (Google,  |            | Checkout    |
              |   Email)   |            | (Hosted,    |
              +-----+------+            |  card-only) |
                    |                   +------+------+
                    | JWT                      |
                    |                          | Webhooks
         +----------v-----------+    +---------v----------+
         |  Next.js 16 (Vercel) |    |  Convex HTTP       |
         |  App Router          |    |  /stripe-webhook   |
         |  + Clerk Middleware  |    +--------+-----------+
         +----------+-----------+             |
                    |                         | ctx.runAction
                    | Convex React SDK        |
                    |                  +------v--------------+
                    +--+               | stripeWebhook.ts    |
                       |               | (Node.js action)    |
                +------v------+        +------+--------------+
                |   Convex    |               |
                |   Backend   |<--------------+
                |  (Queries,  |    ctx.runMutation
                |  Mutations, |
                |  Actions)   |
                +------+------+
                       |
                +------v------+
                |  Convex DB  |
                |  (7 tables) |
                +-------------+
```

## Auth Flow

1. User clicks "Sign Up" or "Sign In"
2. Clerk's `<SignIn>` / `<SignUp>` components handle the auth flow (Google OAuth primary; email/password supported)
3. On success, Clerk issues a JWT stored in the browser session
4. `<ClerkProvider>` wraps the app; `<ConvexProviderWithClerk>` passes the JWT to Convex
5. Convex validates the JWT against the Clerk issuer domain (configured in `convex/auth.config.ts`)
6. Every Convex query/mutation can call `ctx.auth.getUserIdentity()` to get the authenticated user
7. `ConvexClientProvider` calls `getOrCreateUser` on first load to ensure the user exists in the `users` table
8. After sign-up, `forceRedirectUrl="/settings"` routes the user to the unified Account page

## Subscription Flow

```
Sign Up → /settings (Plan picker) → Stripe Checkout → Webhook → Convex DB → App Access
```

1. After Clerk sign-up, user lands on `/settings`
2. `SettingsPage` inspects `dbUser.subscriptionStatus` and renders `PlanPickerView` (no active sub), `ManageView` (active/trialing), or `PastDueView` (past_due)
3. For new users, `PlanPickerView` shows a single `$2.99/mo` plan card
4. `createCheckoutSession` Convex action validates state and creates a Stripe Checkout Session
5. User is redirected to Stripe's hosted checkout page (card collection — Link disabled via Stripe Dashboard)
6. On successful checkout, Stripe fires `checkout.session.completed` webhook
7. Webhook hits `https://<convex-site>/stripe-webhook` → delegates to `stripeWebhook.ts` Node.js action
8. Action retrieves subscription details from Stripe API, updates user record in Convex
9. User is redirected to `/?checkout=success`; subsequent loads of any protected page pass `SubscriptionGuard`

## `/settings` Unified Account Page

A single route handles all subscription-related UX. The view renders based on `subscriptionStatus`:

| subscriptionStatus | cancelAtPeriodEnd | View rendered | What user sees |
|---|---|---|---|
| `none` | any | `PlanPickerView` | "Choose a plan to start cooking." + `$2.99` card |
| `cancelled` | `false` | `PlanPickerView` | "Welcome back. Your previous subscription has ended..." + `$2.99` card |
| `trialing`/`active` | `false` | `ManageView` | Payment + Subscription sections (status "Active", Cancel button, Next charge row) |
| `trialing`/`active` | `true` | `ManageView` | Same as above, but status reads "Cancelled — access until [date]" + Resume button; Next charge row hidden |
| `past_due` | any | `PastDueView` | Orange banner "Your payment didn't go through" + Update payment method button |

**`/pricing` is a 307 redirect to `/settings`** for back-compat with any external links.

**`PaywallScreen`** (rendered by `SubscriptionGuard` when a non-subscriber hits a protected route) redirects to `/settings`.

## State Machine

`subscriptionStatus` maps 1:1 with Stripe's subscription status. `cancelAtPeriodEnd` is a separate boolean tracking pending cancellation. **These are independent dimensions.** The combined view is computed in `ManageView`.

```
                    Stripe truth                  Convex truth
                    ────────────                  ────────────
  Fresh user                                      status=none,  cancelAtPeriodEnd=false
      │
      │ checkout.session.completed
      ▼
  Active sub          status=active               status=active, cancelAtPeriodEnd=false
      │
      │ user clicks Cancel ──────────────┐
      ▼                                  │
  Stripe: cancel_at_period_end=true      │ customer.subscription.updated
  status stays "active"                  │
                                         ▼
                                    status=active, cancelAtPeriodEnd=true
                                    (UI: "Cancelled — access until X" + Resume)
      │
      │ user clicks Resume ──────────────┐
      ▼                                  │
  Stripe: cancel_at_period_end=false     │ customer.subscription.updated
                                         ▼
                                    status=active, cancelAtPeriodEnd=false
                                    (UI: back to normal Active + Cancel button)
      │
      │ OR period_end passes without payment
      ▼
  Stripe: status=canceled                customer.subscription.deleted
                                         ▼
                                    status=cancelled, cancelAtPeriodEnd=false
                                    (UI: paywall → PlanPickerView "Welcome back")
```

**Payment failure path:**

```
Active sub → invoice.payment_failed → status=past_due → PastDueView "Update payment"
           → user updates card via Stripe Portal → invoice.payment_succeeded
           → status=active (recovered)
```

## Server-Side Defense

`SubscriptionGuard` is client-only (React); a signed-in user without an active subscription could bypass it by calling endpoints directly. Server-side guards enforce the paywall for expensive operations.

- **`/api/generate-recipes`** — queries `getSubscriptionSummary`, returns `402 Payment Required` if `!hasActiveSub`. `HomePage.tsx` catches `402` and redirects to `/settings`.
- **`createCheckoutSession` (Convex action)** — refuses duplicate subscriptions with typed `{ok, reason}` result:
  - `already_subscribed` — user already has `trialing`/`active` sub
  - `pending_cancel` — user has active sub but clicked Cancel; redirects to `/settings` to Resume instead of creating a duplicate
  - `past_due` — user has failed payment; redirects to `/settings` to Update payment
  - Allow-list of valid starting states: only `none` and `cancelled` pass through
- **Stale Stripe customer retry** — if the stored `stripeCustomerId` has been garbage-collected by Stripe test-mode, `createCheckoutSession` catches `Stripe.errors.StripeInvalidRequestError` with `code === "resource_missing"` and retries with `customer_email`. Webhook overwrites the stale ID on successful completion.

## Rate Limiting

- **Single tier:** 100 searches per rolling 5-hour window (no plan tiers)
- Enforced server-side in `/api/generate-recipes/route.ts` via `api.searchUsage.checkLimit`
- `searchUsage` table stores one row per search with timestamp
- On each request, query counts recent searches within the window
- Rate limit message shows time until reset without revealing specific numbers

## Webhook Event Handling

| Stripe Event | Action | Notes |
|---|---|---|
| `checkout.session.completed` | Link Stripe customer to user, set subscription status + period end | Uses `mapStatus()` to normalize Stripe status |
| `customer.subscription.updated` | Update status + `cancelAtPeriodEnd` flag + period end | Fires on Cancel, Resume, plan change, trial-to-active |
| `customer.subscription.deleted` | Set `subscriptionStatus: "cancelled"`, `cancelAtPeriodEnd: false` | Fires when period_end passes with pending cancel, or manual delete |
| `invoice.payment_succeeded` | Set status from current Stripe subscription state + period end | Used for trial-to-active and recurring renewals. **Critical:** must use `mapStatus(subscription.status)`, not hardcode `"active"` — would otherwise clobber `trialing` (historical bug, now fixed) |
| `invoice.payment_failed` | Set `subscriptionStatus: "past_due"` | Does not currently re-read subscription, so `cancelAtPeriodEnd` may briefly drift; self-heals on next `subscription.updated` |

Unknown statuses (`incomplete`, `incomplete_expired`, `unpaid`, `paused`) are logged via `console.warn` in `mapStatus()` and stored as-is. `createCheckoutSession`'s allow-list treats them as "already_subscribed" to prevent accidental duplicate-sub creation.

## Data Model

**`users` table** (primary record, keyed on stable Clerk ID):

```ts
users: defineTable({
  clerkId: v.string(),             // Primary identity, never changes
  email: v.string(),               // Cached from Clerk on sign-in
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  stripePriceId: v.optional(v.string()),
  subscriptionStatus: v.string(),  // Stripe-faithful: trialing|active|past_due|cancelled|none
  cancelAtPeriodEnd: v.optional(v.boolean()),
  currentPeriodEnd: v.optional(v.number()),  // ms epoch

  // Deprecated — kept optional for back-compat with pre-existing docs
  plan: v.optional(v.union(v.literal("basic"), v.literal("chef"))),
  hasUsedChefTrial: v.optional(v.boolean()),
  trialEndsAt: v.optional(v.number()),

  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_stripe_customer_id", ["stripeCustomerId"])
```

**Other tables** (`recipes`, `favourites`, `customChefs`, `pantryItems`, `shoppingListItems`, `searchUsage`) all reference users by the string `clerkId`, not a Convex `Id<"users">`. This keeps queries working even before the user record exists (the webhook creates the user row asynchronously).

## Key Architectural Decisions

### Why Convex HTTP + Node.js Action for Webhooks

Convex `httpAction` runs in a V8 isolate (not Node.js). The Stripe SDK requires Node.js for operations like `subscriptions.retrieve()`. Solution: `httpAction` receives the webhook, then delegates to an `internalAction` in `stripeWebhook.ts` (marked `"use node"`) which runs in Node.js and can use the full Stripe SDK. See Decision 16 in the decisions doc.

### Why `userId` is a String (Not Convex ID Ref)

The `userId` field across all tables stores the Clerk user ID string (e.g., `"user_2abc..."`) rather than a Convex `Id<"users">` reference. This avoids a chicken-and-egg problem: Convex queries need to work before the webhook creates the user record. Using the Clerk ID string as a stable identifier allows queries to function independently of the user record's existence.

### Why `subscriptionStatus` is a String, Not an Enum Column

Convex's `v.union(v.literal(...))` would enforce the enum, but status values come from Stripe — if Stripe adds a new status we haven't anticipated, a strict enum would reject the webhook. String-typed `subscriptionStatus` + `mapStatus()` function + `console.warn` on unknown statuses lets the system continue to function while flagging the anomaly for observability.

### Why the State Split (`status` + `cancelAtPeriodEnd` Separately)

The original webhook handler overloaded `subscriptionStatus = "cancelled"` to mean both "pending cancellation" and "truly expired." This broke the Netflix-parity requirement that a user who cancels keeps their paid access until period end. Splitting into a Stripe-faithful status plus a separate `cancelAtPeriodEnd` boolean is the canonical Stripe data model and directly enables the Resume subscription flow. See Decision 22.

### Why `/pricing` Is a Redirect to `/settings` (Not Deleted)

External marketing links, email campaigns, and bookmarks may point to `/pricing`. A `redirect()` (HTTP 307) preserves back-compat. The route stays minimal — just a server component that calls `redirect("/settings")`. Middleware no longer marks `/pricing` as public; the redirect happens before auth anyway. See Decision 19.

### Why Deprecated Schema Fields Stay

Convex validates existing documents against the schema on read. Removing `plan`, `hasUsedChefTrial`, `trialEndsAt` from the schema would fail reads on pre-existing user rows. For a pre-launch app with a handful of test users, a migration run is more expensive than carrying three unused optional fields. See Decision 24.

### Why Optimistic UI for Cancel/Resume

Webhook round-trip from Stripe → Convex → React re-render is 1-5 seconds in typical conditions. Without optimistic UI, users see no feedback for that window and often re-click the button. `ManageView` maintains a `pendingCancelOverride` local state that flips immediately on action success; a `useEffect` clears the override once the webhook-driven truth arrives. See Decision 25.
