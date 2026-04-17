# Auth + Subscription — Architecture Document

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
              | (Google +  |            | Checkout    |
              | Email/Pwd) |            | (Hosted)    |
              +-----+------+            +------+------+
                    |                           |
                    | JWT                       | Webhooks
                    |                           |
         +----------v-----------+    +---------v----------+
         |  Next.js 16 (Vercel) |    |  Convex HTTP       |
         |  App Router          |    |  /stripe-webhook    |
         |  + Clerk Middleware  |    +--------+------------+
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

1. User clicks "Sign Up" or "Sign In" on the app
2. Clerk's `<SignIn>` / `<SignUp>` components handle the auth flow (Google OAuth or email/password)
3. On success, Clerk issues a JWT stored in the browser session
4. `<ClerkProvider>` wraps the app; `<ConvexProviderWithClerk>` passes the JWT to Convex
5. Convex validates the JWT against the Clerk issuer domain (configured in `convex/auth.config.ts`)
6. Every Convex query/mutation can call `ctx.auth.getUserIdentity()` to get the authenticated user
7. `UserSync` component calls `getOrCreateUser` on first load to ensure user exists in the `users` table

## Subscription Flow

```
Sign Up → Pricing Page → Stripe Checkout → Webhook → Convex DB → App Access
```

1. After Clerk sign-up, user is redirected to `/pricing`
2. User selects Basic ($2/mo) or Chef ($3/mo early bird, $7/mo standard)
3. `createCheckoutSession` Convex action creates a Stripe Checkout Session
4. User is redirected to Stripe's hosted checkout page (card collection)
5. Chef plan includes 7-day free trial; Basic charges immediately
6. On successful checkout, Stripe fires `checkout.session.completed` webhook
7. Webhook hits `https://<convex-site>/stripe-webhook` → delegates to `stripeWebhook.ts` Node.js action
8. Action retrieves subscription details from Stripe API, updates user record in Convex
9. App checks `subscriptionStatus` on every protected page load via `SubscriptionGuard`

## Rate Limiting

- **Basic plan**: 5 searches per rolling 5-hour window
- **Chef plan**: 100 searches per rolling 5-hour window
- Enforced server-side in the `/api/generate-recipes` API route
- `searchUsage` table stores one row per search with timestamp
- On each search, query counts recent searches within the window
- Rate limit message shows time until reset without revealing specific numbers

## Webhook Event Handling

| Stripe Event | Action |
|---|---|
| `checkout.session.completed` | Link Stripe customer to user, set plan + subscription status |
| `customer.subscription.updated` | Update plan, status, trial end, period end |
| `customer.subscription.deleted` | Set status to "cancelled" |
| `invoice.payment_succeeded` | Set status to "active", update period end |
| `invoice.payment_failed` | Set status to "past_due" |

## Key Architectural Decisions

### Why Convex HTTP + Node.js Action for Webhooks

Convex `httpAction` runs in a V8 isolate (not Node.js). The Stripe SDK requires Node.js for operations like `subscriptions.retrieve()`. Solution: the `httpAction` receives the webhook, then delegates to an `internalAction` in `stripeWebhook.ts` (marked `"use node"`) which runs in Node.js and can use the full Stripe SDK.

### Why userId is a String (Not Convex ID Ref)

The `userId` field across all tables stores the Clerk user ID string (e.g., `"user_2abc..."`) rather than a Convex `Id<"users">` reference. This avoids a chicken-and-egg problem: Convex queries need to work before the webhook creates the user record. Using the Clerk ID string as a stable identifier allows queries to function independently of the user record's existence.

### Why No Anonymous → Authenticated Migration

The app was pre-launch with no real users. Migrating anonymous `sessionId` data to authenticated `userId` data would add complexity for zero benefit. The anonymous session system was removed entirely.

### Why Clerk Components Instead of Custom Hooks

Clerk v7 changed the `useSignIn`/`useSignUp` hook API significantly. Using Clerk's pre-built `<SignIn>` and `<SignUp>` components (styled with the `appearance` prop) is more maintainable and forward-compatible than building custom auth forms with headless hooks.
