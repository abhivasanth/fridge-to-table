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

---

# Simplification Revision — 2026-04-18

After shipping the two-tier + trial system above, dogfooding surfaced a series of
confusing UX moments and subtle correctness bugs (trial status clobbered by `$0`
invoice, pending-cancel conflated with truly-cancelled, stale Stripe customer IDs
crashing checkout, etc.). The user explicitly asked to simplify. This section
records the reversals and new decisions made on 2026-04-18.

## Decision 17: Single $2.99/mo Plan (Reverses Decisions 1, 9, 10, 11, 12)

**Date:** 2026-04-18
**Context:** The two-tier model (Decision 1) plus early-bird pricing (Decision 9) plus hidden rate limits (Decision 12) created a lot of surface area for a pre-launch app with no users. Every tier-based branch was dead code that could rot. Price-anchoring arguments don't work when you don't have any users to anchor yet.
**Decision:** Collapse to a single `$2.99/mo` plan. No tiers, no early-bird, no first-100, no "Priority access" marketing copy. `getChefSubscriberCount` query deleted. `plan` field marked deprecated in schema. Rate limit single-tier at 100 searches / 5h.
**Rationale:** YAGNI ruthlessly. Pre-launch is exactly the wrong time to tune pricing psychology — that's a post-PMF exercise. A single plan is a simpler mental model for users, fewer bugs for us, easier Stripe dashboard, easier support. Revisit tiering after there are real users to serve.

## Decision 18: No Free Trial (Reverses Decision 3)

**Date:** 2026-04-18
**Context:** The 7-day Chef trial (Decision 3) was the source of most of today's debugging: trial status silently clobbered by the `$0` trial invoice webhook, trial-abuse vectors (users cancel + resubscribe), trial-once enforcement code complexity, trial vs paid copy variants on the cancel modal. The user's intuition was that trial adds product complexity disproportionate to its value at this stage.
**Decision:** Remove the trial entirely. Checkout config no longer passes `trial_period_days`. `hasUsedChefTrial` flag deprecated in schema. Trial-variant copy removed from cancel confirmation modal. Users are charged `$2.99` immediately on sign-up.
**Rationale:** A trial exists to lower friction to first use. `$2.99` is already low-friction. The "give before you ask" pricing psychology of a trial doesn't buy enough at this price point to justify the complexity. If conversion turns out to be a problem post-launch, a trial can be reintroduced as a flag without the complexity that existed before (because the Stripe-faithful state machine from Decision 22 handles trial cleanly).

## Decision 19: Consolidate `/pricing` into `/settings`

**Date:** 2026-04-18
**Context:** We had two routes doing overlapping jobs: `/pricing` for new subscribers, `/settings` for existing. Cancelled users on `/settings` got kicked to `PaywallScreen` which embedded `PricingCards` — effectively a third instance of the same UI. Two URLs the user has to reason about.
**Decision:** `/settings` becomes a single unified Account page that switches views based on `subscriptionStatus`: `PlanPickerView` for `none`/`cancelled`, `ManageView` for `active`/`trialing`, `PastDueView` for `past_due`. `/pricing` is a server-side 307 redirect to `/settings`. `PaywallScreen` is a redirect-to-`/settings` shell. Sign-up's `forceRedirectUrl` updated to `/settings`. `SubscriptionGuard.requiredPlan` dead prop removed.
**Rationale:** Single source of truth. Matches Netflix's "Account" page pattern. Reduces three code paths to one. `/pricing` kept as a redirect (not deleted) so inbound marketing links still work.

## Decision 20: Remove Profile Section from `/settings`

**Date:** 2026-04-18
**Context:** `/settings` had a Profile section (first name, last name, email) with editable fields and an `updateProfile` Convex mutation. Clerk's UserButton already opens a "Manage account" modal that handles all of this natively.
**Decision:** Delete the Profile section and the `updateProfile` mutation. Rename page heading from "Account" to "Subscription" to reflect its narrower scope. Display name and email edits happen via Clerk's modal, accessed from the UserButton avatar in the top nav.
**Rationale:** DRY. Our custom profile UI was a duplicate of what Clerk provides. The risk of stale state (Convex cache vs. Clerk source of truth) was real. Users who change their email in Clerk would see stale email in our settings until next sign-in. Removing the duplication eliminates the whole class of sync bugs.

## Decision 21: Lock Email Changes via Clerk Dashboard (Not Code)

**Date:** 2026-04-18
**Context:** Clerk lets users change their primary email in the Manage Account modal. Our Convex schema keys users on `clerkId` (stable), so identity is safe — but `dbUser.email` cache goes stale on email changes, and Stripe customer records retain old email until synced.
**Decision:** Disable "Users can add email addresses" in Clerk Dashboard → User & Authentication → Email, Phone, Username. Rely on this configuration rather than writing a Clerk `user.updated` webhook handler.
**Rationale:** Locking email matches Netflix's model (you can't change your login email without contacting support). Eliminates drift without writing sync code. The small number of users who genuinely need an email change can email support — acceptable cost pre-launch.

## Decision 22: Stripe-Faithful State Model (`status` + `cancelAtPeriodEnd`)

**Date:** 2026-04-18
**Context:** The original webhook handler overloaded `subscriptionStatus = "cancelled"` to mean both "user clicked cancel, pending period end" AND "subscription has truly ended." This broke the user experience: clicking Cancel immediately kicked the user to the paywall even though they still had a paid period ahead. It also made "Resume subscription" impossible to implement correctly.
**Decision:** `subscriptionStatus` maps 1:1 with Stripe's subscription status (`trialing | active | past_due | cancelled`). New column `cancelAtPeriodEnd: boolean` tracks pending cancellation separately. `SubscriptionGuard` grants access when status is `trialing` or `active`, regardless of `cancelAtPeriodEnd`. `ManageView` status label reads "Cancelled — access until [date]" when pending-cancel, with a "Resume subscription" button. Added `resumeSubscription` action that flips `cancel_at_period_end: false` in Stripe.
**Rationale:** Netflix-parity cancel UX. The user keeps the access they paid for; the UI reflects their cancellation intent without overselling what's been cancelled. The Stripe-faithful naming is defensive: if Stripe adds a status we don't handle (e.g. `paused`), `mapStatus` logs and falls through rather than misclassifying. Enables genuine un-cancel flow.

## Decision 23: Server-Side Subscription Guard on API Routes

**Date:** 2026-04-18 (during code review)
**Context:** `SubscriptionGuard` is a client-only React component. A signed-in user with `subscriptionStatus = "none"` could bypass the UI and directly `fetch("/api/generate-recipes", ...)` from devtools to get Anthropic-generated recipes without paying.
**Decision:** `/api/generate-recipes/route.ts` queries `getSubscriptionSummary` and returns `402 Payment Required` if `hasActiveSub !== true`. `HomePage.tsx` catches `402` responses and redirects to `/settings`.
**Rationale:** Defense-in-depth. The client guard is for UX (prevents rendering the wrong screen); the server guard is for correctness (prevents paying for API calls from non-subscribers). Status code `402` is the HTTP-standard signal for "subscription required." Deferred for other server endpoints (`analyzePhoto`, `searchChefVideos`) as a follow-up — see Open Questions.

## Decision 24: Deprecated Schema Fields Kept Optional (Not Migrated)

**Date:** 2026-04-18
**Context:** Removing tier + trial functionality meant three fields (`plan`, `hasUsedChefTrial`, `trialEndsAt`) and one index (`by_plan`) became dead. Existing user rows still have these set from their original sign-ups during testing.
**Decision:** Drop the `by_plan` index. Keep the fields as `v.optional(...)` in `convex/schema.ts` with a deprecation comment. No data migration; no code reads or writes them after this revision.
**Rationale:** Convex schemas validate existing docs on read. Removing the fields would fail reads on pre-existing rows until migrated. For pre-launch with ~5 test users, the juice isn't worth the squeeze — optional schema fields are effectively no-ops when nothing reads them. Migrate when the schema is reshaped for a real reason.

## Decision 25: Optimistic UI Override for Cancel/Resume

**Date:** 2026-04-18 (during review-pass-1 fixes)
**Context:** Clicking Cancel/Resume hit Stripe, returned `{ok: true}`, but the UI (status label, button affordance) didn't update until the Stripe `customer.subscription.updated` webhook arrived and patched Convex. On a 1-5 second lag, users saw no feedback and often re-clicked the button.
**Decision:** `ManageView` maintains a `pendingCancelOverride: boolean | null` local state. On action success, override is set immediately. A `useEffect` clears the override once `dbUser.cancelAtPeriodEnd` catches up to match.
**Rationale:** Webhook round-trip is intrinsic to the architecture. Optimistic UI decouples perceived responsiveness from the webhook. The self-clearing `useEffect` means we only override until truth arrives — no persistent divergence.

## Decision 26: Error Scoping in `ManageView` (Split `portalError` from `subActionError`)

**Date:** 2026-04-18 (during cumulative review)
**Context:** A single `subActionError` state served three actions (Update card, Cancel, Resume). Cancel and Resume render in the Subscription section at the bottom; Update card lives in the Payment section at the top. A failed Update card surfaced its error 200px below the button, visually attached to Cancel.
**Decision:** Split into `portalError` (rendered inline below "Update card" in the Payment section) and `subActionError` (rendered below Cancel/Resume in the Subscription section). All three handlers clear both on start so a stale portal error doesn't survive a subsequent Cancel attempt.
**Rationale:** Errors belong next to the thing that caused them. Spatial separation of action and error message caused real "did I break cancel?" confusion. YAGNI-rejected a `useAsyncAction` hook abstraction (Option C in the brainstorm) — two call sites are below the rule-of-three threshold.

## Decision 27: Netflix Founder-Access via Stripe 100% Coupon (Not Code-Level Admin)

**Date:** 2026-04-18
**Context:** Founder needs free access. Options: (a) hardcoded `ADMIN_CLERK_IDS` env var bypassing the subscription check, (b) `role: "admin"` schema column with authz everywhere, (c) 100%-off Stripe coupon applied to founder's customer record.
**Decision:** Stripe coupon. No code changes required. Founder subscribes like any user, Stripe invoices $0 forever via the coupon, webhook sets status to `active`, they appear identical to a paying user everywhere in the app.
**Rationale:** Founder dogfoods the real flow — if anything breaks for paying users, the founder sees it too. Avoids code-level authz surface (allowlist committed to repo, employee list growing over time, audit noise). Same pattern used by Netflix, Spotify, and most SaaS comps. A proper `role` system can be built later when there are actual admin workflows (customer support lookups, refunds, content moderation) — not just "bypass the paywall."

---

## Decisions Still Open

- **Server-side subscription guard on `analyzePhoto` and `searchChefVideos`** — Decision 23 covers `generate-recipes` but these Convex actions are still client-gated only. Not blocking for launch (SubscriptionGuard catches the happy path) but a priority follow-up for defense-in-depth.
- **Google-only vs. keep email+password sign-in** — leaning Google-only (cleaner Manage Account modal) but inclusive of email+password users. Revisit based on sign-up attribution post-launch.
- **Clerk `user.updated` webhook for email sync** — deferred per Decision 21. If we ever unlock email changes, this becomes required.
