# Auth + Subscription — Decision Log

Chronological record of product and technical decisions made during the auth + subscription feature build.

---

## Decision 1: Two-Tier Subscription Model (Not Single Tier)

**Date:** 2026-04-16
**Context:** Initially planned as a single $3/mo plan for all features. User provided a mockup showing two tiers.
**Decision:** Two tiers — Basic ($2/mo) and Chef ($3/mo, $7/mo after first 100 users).
**Rationale:** Price anchoring — Basic makes Chef feel like a better deal. Early bird pricing creates urgency.

## Decision 2: No Free Tier

**Date:** 2026-04-16
**Context:** Considered freemium with usage limits, feature gates, or free trial.
**Decision:** No free usage. Sign up + pay required for all access.
**Rationale:** App was pre-launch, no existing free user base to protect. Clean monetization from day one.

## Decision 3: 7-Day Free Trial on Chef Plan Only

**Date:** 2026-04-16
**Context:** Considered free trial on both plans.
**Decision:** Trial only on Chef. Basic charges immediately.
**Rationale:** $2/mo is low enough friction. Trial on Chef creates an upgrade path — users experience premium, then downgrading feels like a loss.

## Decision 4: Card Upfront at Sign-Up

**Date:** 2026-04-16
**Context:** Could allow sign-up without card, then paywall later.
**Decision:** Card required at sign-up during Stripe Checkout.
**Rationale:** Reduces tire-kickers. Stripe auto-charges when trial ends — no manual conversion step.

## Decision 5: Google + Email/Password Auth

**Date:** 2026-04-16
**Context:** Initially considered Google-only for simplicity.
**Decision:** Both Google OAuth and email/password via Clerk.
**Rationale:** Almost zero additional implementation cost — Clerk handles both. Covers the ~10% of users who won't use Google.

## Decision 6: No Anonymous Data Migration

**Date:** 2026-04-16
**Context:** Existing app had anonymous sessionId-based data (favourites, pantry, shopping list).
**Decision:** No migration. Wipe all anonymous data.
**Rationale:** App was pre-launch with no real users. Migration complexity wasn't justified.

## Decision 7: Hard Lock on Payment Failure / Cancellation

**Date:** 2026-04-16
**Context:** Could show read-only mode or degraded access.
**Decision:** Hard lock screen — "Your subscription has ended" with plan options.
**Rationale:** Simpler code, clearer upgrade pressure. User data is preserved and unlocked on resubscription.

## Decision 8: In-App Cancel Confirmation

**Date:** 2026-04-16
**Context:** Could redirect to Stripe Customer Portal for cancellation.
**Decision:** In-app "Are you sure?" confirmation page. Only use Stripe Portal for card updates.
**Rationale:** Keeps cancellation flow branded. "Keep my subscription" as primary CTA reduces churn.

## Decision 9: First 100 Users Early Bird Pricing

**Date:** 2026-04-16
**Context:** Chef plan pricing.
**Decision:** $3/mo for first 100 Chef subscribers, $7/mo after. Existing $3 users keep their rate.
**Rationale:** Scarcity + urgency drives early adoption. Stripe handles rate locking via separate price IDs.

## Decision 10: "Priority Access" as Marketing Copy Only

**Date:** 2026-04-16
**Context:** Chef plan card includes "Priority access" text.
**Decision:** No feature behind it — purely marketing positioning.
**Rationale:** Makes Chef tier feel premium without engineering effort. Can be backed by a real feature later.

## Decision 11: All Features for Both Plans (Volume Differentiation)

**Date:** 2026-04-17
**Context:** Initially feature-gated (photo scan + Chef's Table = Chef only). User pivoted.
**Decision:** Both plans get all features. Differentiation is search volume only.
**Rationale:** Simpler mental model for users. Basic users discover the limit naturally. Upgrade message appears when they hit it without revealing specific numbers.

## Decision 12: Hidden Rate Limits

**Date:** 2026-04-17
**Context:** Could show "5 of 20 searches used" or similar.
**Decision:** Never show specific numbers. Basic: "Standard usage limits apply". Chef: "Priority access with higher limits". Rate limit message: "You've reached your search limit for now."
**Rationale:** Luxury feel. Users don't count searches — they just use the app until nudged to upgrade.

## Decision 13: Settings Page Over Stripe Portal

**Date:** 2026-04-16
**Context:** Could rely entirely on Clerk's UserButton + Stripe Portal for all account management.
**Decision:** Custom `/settings` page with first name, last name, email, card details, subscription status, and cancel button.
**Rationale:** User specifically requested it. Card update still delegates to Stripe Portal, but everything else is in-app and branded.

## Decision 14: Voice Input Kept for All Users

**Date:** 2026-04-16
**Context:** User noted voice input doesn't work well. Initially removed from Chef plan features.
**Decision:** Keep voice input in the app for all users, just don't market it as a feature.
**Rationale:** Low cost to keep. Removing it would be a separate cleanup task.

## Decision 15: Clerk Pre-Built Components Over Custom Forms

**Date:** 2026-04-17 (during implementation)
**Context:** Plan specified custom auth form using Clerk's `useSignIn`/`useSignUp` hooks.
**Decision:** Switched to Clerk's pre-built `<SignIn>` and `<SignUp>` components with `appearance` styling.
**Rationale:** Clerk v7 changed the hook API significantly, causing type errors. Pre-built components are forward-compatible, handle edge cases (email verification, password reset), and are styled via `appearance` prop.

## Decision 16: Stripe Webhook via Node.js Action (Not httpAction)

**Date:** 2026-04-17 (during debugging)
**Context:** Initial webhook handler used `httpAction` directly with Stripe SDK. Webhook silently failed.
**Decision:** `httpAction` delegates to an `internalAction` marked `"use node"` in `stripeWebhook.ts`.
**Rationale:** Convex's `httpAction` runs in a V8 isolate, not Node.js. The Stripe SDK requires Node.js for API calls like `subscriptions.retrieve()`. Splitting the handler lets the HTTP routing happen in V8 while Stripe SDK operations run in Node.js.
