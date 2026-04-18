# Auth + Subscription Design Spec

## Overview

Add authentication (Clerk) and two-tier subscription billing (Stripe) to Fridge to Table. Replace the anonymous sessionId system with real user accounts. Gate all app functionality behind sign-up + payment. Every paying user gets rate-limited to 20 recipe searches per rolling 5-hour window.

## Business Model

Two subscription tiers, no free usage:

### Basic Plan — $2/month
- Recipe search (text input + voice input)
- Pantry tracker
- Shopping list
- Save favourites
- Cooking history
- No trial — pay immediately on sign-up
- 20 searches per rolling 5-hour window

### Chef Plan — $3/month (first 100 users), then $7/month
- Everything in Basic
- Photo scan (fridge, grocery bill, bowl of ingredients — any food image)
- Chef's Table videos (featured + custom YouTube chefs)
- 7-day free trial with card upfront, auto-charges on day 7
- 20 searches per rolling 5-hour window
- "Priority access" — marketing copy only, no feature behind it

### First 100 Users Mechanic
- Track Chef plan subscriber count in Convex `users` table
- When count reaches 100, new Chef sign-ups see $7/month price
- Existing $3/month users keep their rate locked in (Stripe handles this — different price IDs)
- Two Stripe Price IDs for Chef product: `chef_early` ($3) and `chef_standard` ($7)
- Pricing page footer: "Chef plan is $3/mo for the first 100 members, then $7/mo. Lock in your rate today."

---

## User Flows

### First Visit (Unauthenticated)
1. User lands on `/` — sees the current homepage (hero, ingredient input, Chef's Table preview, testimonials, features)
2. All interactive elements are visible but disabled — ingredient input is read-only, "Find Recipes" button says "Sign Up to Start"
3. Top nav shows "Sign In" and "Sign Up" buttons
4. Clicking any disabled element, "Sign Up to Start", or nav buttons → redirects to `/sign-up`
5. Sidebar nav links (Favourites, Pantry, Shopping List, My Chefs) also redirect to `/sign-up`

### Sign Up
1. User arrives at `/sign-up`
2. Page shows Fridge to Table logo at top
3. Tabbed form: "Sign in" / "Sign up" toggle (Sign up tab active)
4. "Continue with Google" button
5. "or" divider
6. Email address + Password fields
7. "Sign up" button
8. "Forgot password?" link (visible on Sign in tab)
9. Footer: "By continuing you agree to our Terms and Privacy Policy"
10. On successful sign-up → redirect to `/pricing`

### Pricing Page (`/pricing`)
1. Top banner pills: "Pantry + shopping list", "Save favourite recipes", "Chef's Table videos"
2. Heading: "CHOOSE YOUR PLAN TO GET STARTED"
3. Two plan cards side by side (matching mockup):

**Basic card:**
- "Basic" title
- "$2/mo" price
- "Everything you need to cook smarter every night."
- Green checkmarks: Recipe search, Pantry tracker, Shopping list, Save favourites, Cooking history
- "Standard usage limits apply" note
- "Get started" button → Stripe Checkout (Basic, $2/mo, no trial)

**Chef card (highlighted, blue border):**
- "First 100 users" badge (or hidden if count >= 100)
- "Chef" title
- "$3/mo" price (or "$7/mo" if count >= 100)
- "The full experience -- scan, speak, watch and cook."
- Green checkmarks: Everything in Basic, Photo scan, Chef's Table videos
- "Priority access. Standard pricing $7/mo after" note (hidden if count >= 100)
- "Get Chef plan" button → Stripe Checkout (Chef, $3 or $7/mo, 7-day trial)

4. Footer: "Chef plan is $3/mo for the first 100 members, then $7/mo. Lock in your rate today." (hidden if count >= 100)

### Stripe Checkout
- **Basic**: mode=subscription, price=basic_price_id, no trial
- **Chef**: mode=subscription, price=chef_early_price_id or chef_standard_price_id, trial_period_days=7
- Both: payment_method_collection=always (card required upfront)
- On success → redirect to `/` (app, now authenticated + subscribed)
- On cancel → redirect back to `/pricing`

### Sign In (Returning User)
1. User arrives at `/sign-in`
2. Same page as sign-up but "Sign in" tab active
3. "Continue with Google" or email/password
4. On success → redirect to `/` (app)
5. If subscription is active → full access
6. If subscription is cancelled/expired/payment failed → hard lock screen

### Active Subscriber
- Full access to features based on plan tier
- Basic users: recipe search, pantry, shopping list, favourites, cooking history, voice input
- Chef users: all Basic features + photo scan + Chef's Table
- Rate limited: 20 searches per rolling 5-hour window
- Clerk `<UserButton>` in nav (replaces Sign In / Sign Up buttons)

### Rate Limit Hit
- User sees friendly message: "You've used all 20 searches for now. Resets in X hours Y minutes."
- Checked server-side in Convex before calling Claude API
- Applies equally to Basic and Chef users
- Counter resets on a rolling window (timestamps older than 5 hours are pruned)

### Payment Failed / Subscription Cancelled
- Hard lock screen covers the entire app
- Message: "Your subscription has ended. Choose a plan to continue cooking."
- Two buttons: "Get Basic ($2/mo)" and "Get Chef ($3/mo)" → Stripe Checkout
- User's data (favourites, pantry, shopping list, custom chefs, history) is preserved
- Resubscribing unlocks everything immediately

### Cancel Subscription Flow
1. User navigates to `/settings`
2. Clicks "Cancel subscription" button
3. In-app confirmation page: "Are you sure you want to cancel?"
4. Shows what they'll lose: "Your access ends on [billing period end date]"
5. "Keep my subscription" button (primary, prominent)
6. "Yes, cancel" button (secondary, muted)
7. Clicking "Yes, cancel" → Stripe cancels at period end
8. User keeps access until billing period ends, then hard lock screen

---

## Auth Architecture

### Clerk Integration
- **Package**: `@clerk/nextjs`
- **Provider**: `<ClerkProvider>` wraps the app in `app/layout.tsx`
- **Convex integration**: Clerk JWT validation via Convex's built-in Clerk auth support
- **Auth config**: `convex/auth.config.ts` with Clerk issuer domain
- **User identity**: All Convex functions use `ctx.auth.getUserIdentity()` to get the authenticated user
- **Sign-in component**: Custom-built UI using Clerk's `useSignIn` and `useSignUp` hooks (not default Clerk components) to match the mockup design
- **User button**: Clerk's `<UserButton>` component in nav for signed-in users (avatar dropdown with profile management, sign out)

### Auth Pages
- `/sign-in` — custom sign-in page with Fridge to Table branding
- `/sign-up` — same component, Sign up tab active
- Both use Clerk's headless hooks for Google OAuth + email/password flows
- Fridge to Table logo at top
- Tabbed toggle between Sign in and Sign up
- "Continue with Google" button
- "or" divider
- Email + password fields
- "Forgot password?" link (Clerk handles reset flow)
- "By continuing you agree to our Terms and Privacy Policy" footer

### Auth Guard
- Middleware (`middleware.ts`) using Clerk's `authMiddleware` or `clerkMiddleware`
- Public routes: `/`, `/sign-in`, `/sign-up`, `/pricing`
- Protected routes: everything else (`/results/*`, `/recipe/*`, `/favourites`, `/my-chefs`, `/chef-results`, `/my-pantry`, `/my-shopping-list`, `/settings`, `/api/generate-recipes`)
- Unauthenticated access to protected routes → redirect to `/sign-in`
- Authenticated but no active subscription → redirect to `/pricing` (if never subscribed) or show hard lock screen (if expired/cancelled)

---

## Payments Architecture

### Stripe Integration
- **Package**: `stripe` (server-side only)
- **Checkout**: Stripe Checkout Sessions (hosted page) for both plan sign-ups and resubscriptions
- **Customer Portal**: Stripe Customer Portal for updating card details (linked from Settings page)
- **Webhooks**: Convex HTTP endpoint receives Stripe webhook events

### Stripe Products & Prices
- **Product 1**: "Fridge to Table Basic"
  - Price: $2/month recurring
- **Product 2**: "Fridge to Table Chef"
  - Price A (chef_early): $3/month recurring — used for first 100 subscribers
  - Price B (chef_standard): $7/month recurring — used after 100 subscribers

### Stripe Webhook Events → Convex HTTP Endpoint
| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update user record: set stripeCustomerId, stripeSubscriptionId, plan, subscriptionStatus="active" (or "trialing" for Chef) |
| `customer.subscription.updated` | Update subscriptionStatus, plan, currentPeriodEnd |
| `customer.subscription.deleted` | Set subscriptionStatus="cancelled" |
| `invoice.payment_succeeded` | Update subscriptionStatus="active", update currentPeriodEnd |
| `invoice.payment_failed` | Set subscriptionStatus="past_due" |

### Checkout Flow
1. User clicks "Get started" or "Get Chef plan" on `/pricing`
2. Frontend calls a Convex action that creates a Stripe Checkout Session
3. Action returns the Checkout URL
4. Frontend redirects to Stripe Checkout (hosted page)
5. User enters card → Stripe processes → redirects to success URL (`/`)
6. Stripe fires `checkout.session.completed` webhook → Convex updates user record

---

## Data Model Changes

### New: `users` Table
```
users: defineTable({
  clerkId: v.string(),           // Clerk user ID (from JWT subject)
  email: v.string(),
  firstName: v.optional(v.string()),
  lastName: v.optional(v.string()),
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  plan: v.optional(v.union(v.literal("basic"), v.literal("chef"))),
  stripePriceId: v.optional(v.string()),
  subscriptionStatus: v.string(), // "active" | "trialing" | "past_due" | "cancelled" | "none"
  trialEndsAt: v.optional(v.number()),
  currentPeriodEnd: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_stripe_customer_id", ["stripeCustomerId"])
  .index("by_plan", ["plan"])
```

### New: `searchUsage` Table
```
searchUsage: defineTable({
  userId: v.id("users"),
  searchedAt: v.number(),        // Date.now() timestamp
})
  .index("by_user", ["userId"])
  .index("by_user_and_time", ["userId", "searchedAt"])
```

Rate limit check: query `searchUsage` where `userId == user._id` and `searchedAt > Date.now() - 5*60*60*1000`. If count >= 20, reject with time-until-reset.

### Modified Tables — Replace `sessionId` with `userId`

All five existing tables change `sessionId: v.string()` to `userId: v.id("users")`:

- **recipes**: `sessionId` → `userId`, index `by_session` → `by_user`
- **favourites**: `sessionId` → `userId`, indexes updated
- **customChefs**: `sessionId` → `userId`, index updated
- **pantryItems**: `sessionId` → `userId`, indexes updated
- **shoppingListItems**: `sessionId` → `userId`, indexes updated

### Feature Gating by Plan

| Feature | Basic | Chef |
|---------|-------|------|
| Recipe search (text) | Yes | Yes |
| Voice input | Yes | Yes |
| Pantry tracker | Yes | Yes |
| Shopping list | Yes | Yes |
| Save favourites | Yes | Yes |
| Cooking history | Yes | Yes |
| Photo scan | No | Yes |
| Chef's Table | No | Yes |
| My Chefs | No | Yes |

Feature gate checks happen in:
- **Frontend**: Hide/disable Chef-only UI elements for Basic users. Photo button hidden. Chef's Table tab hidden.
- **Backend**: Convex mutations/actions for Chef-only features check user's plan before executing. Return clear error if plan doesn't allow it.

---

## Settings Page (`/settings`)

### Layout
Single page with the following sections:

**Profile**
- First name (editable)
- Last name (editable)
- Email (display only — managed by Clerk)

**Payment**
- Card on file: "Visa ending in 4242" (last 4 from Stripe)
- "Update card" link → opens Stripe Customer Portal

**Subscription**
- Current plan: "Basic" or "Chef"
- Status: "Active" or "Trial (ends Apr 23, 2026)"
- Next billing date: "Next charge: $2 on May 16, 2026"
- "Cancel subscription" button → in-app confirmation

### Cancel Confirmation
- Rendered as a separate view/modal within `/settings`
- Heading: "Are you sure you want to cancel?"
- Body: "Your access ends on [current period end date]. Your recipes, pantry, and favourites will be saved."
- "Keep my subscription" button — primary, prominent
- "Yes, cancel" button — secondary, muted
- On cancel: Stripe cancels at period end, status updates to "cancelled", user keeps access until period ends

---

## Pages Summary

| Route | Auth Required | Subscription Required | New/Modified |
|-------|--------------|----------------------|-------------|
| `/` | No | No (disabled UI if logged out; feature-gated if logged in) | Modified |
| `/sign-in` | No | No | New |
| `/sign-up` | No | No | New |
| `/pricing` | No | No | New |
| `/settings` | Yes | Yes | New |
| `/results/[id]` | Yes | Yes | Modified |
| `/recipe/[id]/[index]` | Yes | Yes | Modified |
| `/favourites` | Yes | Yes (Basic+) | Modified |
| `/my-chefs` | Yes | Yes (Chef only) | Modified |
| `/chef-results` | Yes | Yes (Chef only) | Modified |
| `/my-pantry` | Yes | Yes (Basic+) | Modified |
| `/my-shopping-list` | Yes | Yes (Basic+) | Modified |
| `/api/generate-recipes` | Yes | Yes | Modified |

---

## Code Changes Summary

### Remove
- `lib/session.ts` — anonymous session system deleted entirely
- `components/BottomNav.tsx` — unused legacy component
- `components/Navbar.tsx` — unused legacy component
- All `getSessionId()` calls across the codebase
- localStorage `fridge_session_id` key usage

### Add
- `@clerk/nextjs` package
- `stripe` package
- `<ClerkProvider>` in `app/layout.tsx`
- `convex/auth.config.ts` — Clerk auth configuration for Convex
- `middleware.ts` — Clerk auth middleware with public/protected route config
- `app/sign-in/[[...sign-in]]/page.tsx` — custom sign-in page
- `app/sign-up/[[...sign-up]]/page.tsx` — custom sign-up page
- `app/pricing/page.tsx` — two-tier pricing page
- `app/settings/page.tsx` — settings page (profile, payment, subscription, cancel)
- `components/AuthGuard.tsx` — subscription status check wrapper
- `components/PaywallScreen.tsx` — hard lock screen for expired/cancelled
- `components/PricingCards.tsx` — two-tier plan cards (matching mockup)
- `components/SignInForm.tsx` — custom auth form (tabbed, Google + email/password)
- `convex/users.ts` — user CRUD, subscription status helpers, first-100 counter
- `convex/searchUsage.ts` — rate limit tracking (20/5hr)
- `convex/stripe.ts` — Stripe Checkout session creation action
- `convex/http.ts` — Stripe webhook HTTP endpoint

### Modify
- `convex/schema.ts` — add `users` and `searchUsage` tables, change `sessionId` → `userId` on all 5 existing tables
- `convex/recipes.ts` — use `ctx.auth`, rate limit check before generation
- `convex/favourites.ts` — use `ctx.auth` instead of sessionId
- `convex/customChefs.ts` — use `ctx.auth`, plan gate (Chef only)
- `convex/pantry.ts` — use `ctx.auth`
- `convex/shoppingList.ts` — use `ctx.auth`
- `convex/chefs.ts` — use `ctx.auth`, plan gate (Chef only)
- `convex/photos.ts` — use `ctx.auth`, plan gate (Chef only)
- `app/layout.tsx` — wrap with `<ClerkProvider>`
- `app/page.tsx` — disable UI for unauthenticated, feature-gate by plan
- `app/api/generate-recipes/route.ts` — add auth check, rate limit check
- `components/HomePage.tsx` — disable inputs when logged out, hide Chef's Table tab for Basic users, "Sign Up to Start" CTA
- `components/ClientNav.tsx` — add Sign In / Sign Up buttons (logged out) or `<UserButton>` (logged in), add Settings link
- `components/Sidebar.tsx` — add Settings nav link, gate Chef-only links
- `components/IngredientInput.tsx` — hide photo button for Basic users
- `components/ConvexClientProvider.tsx` — integrate with Clerk auth token

---

## Environment Variables

### New Variables
| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` + Vercel | Clerk publishable key |
| `CLERK_SECRET_KEY` | `.env.local` + Vercel | Clerk secret key (server-side only) |
| `STRIPE_SECRET_KEY` | Convex env + `.env.local` | Stripe secret key (server-side only) |
| `STRIPE_WEBHOOK_SECRET` | Convex env | Stripe webhook signing secret |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `.env.local` + Vercel | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `.env.local` + Vercel | `/sign-up` |
| `STRIPE_BASIC_PRICE_ID` | Convex env | Stripe Price ID for Basic plan |
| `STRIPE_CHEF_EARLY_PRICE_ID` | Convex env | Stripe Price ID for Chef plan ($3) |
| `STRIPE_CHEF_STANDARD_PRICE_ID` | Convex env | Stripe Price ID for Chef plan ($7) |

---

## Testing Strategy

### Unit Tests
- Auth guard component: renders children when authenticated + subscribed, redirects when not
- Paywall screen: renders correct plan options
- Feature gate logic: Basic vs Chef feature access
- Rate limit utility: count within window, reset calculation
- Pricing cards: correct prices, first-100 badge visibility
- Settings page: displays user info, subscription status

### Integration Tests
- User creation on first sign-in (Convex)
- Subscription status updates from webhook events
- Rate limit enforcement (20 searches, window reset)
- Feature gate enforcement (Basic user can't access Chef features)
- Plan upgrade/downgrade handling

### E2E Tests
- Sign up flow → pricing → Stripe Checkout (use Stripe test mode)
- Sign in → app access
- Rate limit message appears after 20 searches
- Basic user cannot see Chef's Table tab or photo button
- Settings page displays correct info
- Cancel flow with confirmation
