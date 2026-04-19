# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Workflow

This project enforces a **design-first, plan-driven** development methodology through custom skills in `.claude/skills/`. Always follow this sequence for any new feature or meaningful change:

1. **Brainstorm** (`/brainstorming`) — Before writing any code, explore requirements, ask clarifying questions (one at a time), propose 2-3 approaches, present design sections for approval, then write the design doc to `docs/plans/YYYY-MM-DD-<topic>-design.md`.
2. **Write a plan** (`/writing-plans`) — Convert the approved design into a detailed implementation plan saved to `docs/plans/YYYY-MM-DD-<feature-name>.md`. Plans must have bite-sized tasks (2-5 min each), exact file paths, complete code, and TDD steps.
3. **Execute** (`/executing-plans`) — Load the plan, review critically, then execute in batches of ~3 tasks with checkpoints. Stop and ask if blocked; do not guess.
4. **Verify** (`/verification-before-completion`) — Before any completion claim: identify the verification command, run it fresh, read the full output, then state the result with evidence. No exceptions.
5. **Debug** (`/systematic-debugging`) — For any bug or failure: complete all four phases (Root Cause Investigation → Pattern Analysis → Hypothesis Testing → Implementation) before proposing a fix. After 3+ failed fixes, question the architecture.

## Core Principles

- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **TDD** — write the failing test before the implementation
- **DRY** — avoid duplication in both code and tests
- **Frequent commits** — commit after each passing task step
- **Root cause, not symptoms** — never fix a symptom when you haven't traced the root cause
- **Evidence before claims** — never say work is complete without running verification and showing output

## Auth Architecture (Clerk + Convex)

Every user-owned data path in this project follows one pattern. Never invent a new one.

### Convex functions — always derive userId server-side

**Never accept `userId` as a client argument.** The client cannot be trusted to identify itself. All user-owned queries, mutations, and actions must derive identity from the Clerk JWT:

```ts
// convex/favourites.ts
import { requireUserId } from "./auth";

export const getFavourites = query({
  args: {},  // ← no userId here
  handler: async (ctx) => {
    const userId = await requireUserId(ctx);  // ← from JWT, throws if unauth
    return await ctx.db
      .query("favourites")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});
```

The helper lives in `convex/auth.ts`:

```ts
export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  return identity.subject;  // Clerk user ID
}
```

For `ActionCtx` (action handlers), inline `ctx.auth.getUserIdentity()` + null check — `requireUserId` currently doesn't accept `ActionCtx`:

```ts
// convex/photos.ts — pattern used by every action that calls an external paid API
handler: async (ctx, args) => {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  // ... rest of handler
}
```

### Invariants (must be preserved in every PR)

These are the non-negotiable rules. A grep for any of these will catch regressions:

1. **No Convex query, mutation, or action that reads or writes user-owned data may accept `userId` as a client argument.** Identity is always derived server-side via `requireUserId(ctx)` (queries/mutations) or `ctx.auth.getUserIdentity()` (actions). Use `grep -rn "userId: v.string()" convex/` — the only legitimate hit is on `internalMutation`s that are explicitly not callable from the client.

2. **Every Convex action that calls an external paid API (Anthropic, YouTube, or any future provider) must be auth-gated.** This protects against cost/DoS attacks from anonymous callers who know the function name. Today that's `photos.analyzePhoto`, `chefs.searchChefVideos`, `customChefs.resolveYouTubeChannel`, and `recipes.generateRecipes` — all four inline `ctx.auth.getUserIdentity()` + null-check as the first statement in their handler. **Any new action that fits this profile must match this pattern.** Convert-on-sight if you see an external `fetch(...)` or API-client call in an action with no auth check above it.

3. **Every `useQuery(api.*, ...)` against an auth-required Convex function must gate on `useAuthedUser().isReady`.** Including queries inside child components whose parent already gated — token rotation and sign-out can temporarily flip Convex auth off, and an unguarded child query will throw `"Not authenticated"` until the subscription retries. Gate every site; do not rely on the parent having gated.

4. **Every client-side submit handler that invokes a user-owned action/mutation or an authed API route must early-return with a `/sign-in` redirect when `!user`.** Don't fire the network call and hope the server-side rejection renders cleanly — it won't; a catch-all will swallow it as a generic error. `components/HomePage.tsx:handleSubmit` is the canonical example.

5. **Every `Id<"table">` arg on a public mutation must be ownership-checked.** Pattern: `get → null-guard → userId-compare → throw "Forbidden"`. This applies to both delete-by-ID (`removeFromPantry`, `removeFromShoppingList`) and any mutation that references a user-owned row by its Convex ID (`saveFavourite` — checks `recipeSetId`).

6. **Integration tests must cover the negative path for invariants 1, 2, and 5.** For each user-owned function: one `t.mutation(...)` (or `.query`/`.action`) call with no identity asserting `/Not authenticated/`, and for invariant 5, one cross-user ownership test asserting `/Forbidden/`. See `tests/integration/pantry.test.ts` and `tests/integration/shoppingList.test.ts` for the canonical shape.

7. **Any submit handler that redirects a signed-out user to `/sign-in` must persist the user's in-flight intent to `sessionStorage` first.** Users who click Find Recipes while signed out lose their work if we redirect without saving. Pattern: `saveSearchState({ activeTab, ingredientText: ingredients.join(", "), filters })` before `router.push("/sign-in")`. The receiving side (`HomePage.tsx`'s mount `useEffect`) must also restore **every** field it saves — saving `activeTab` without calling `setActiveTab` on restore is a silent bug that drops the user on the default tab. sessionStorage is tab-scoped and survives OAuth round-trips; photo uploads are intentionally not preserved (too large, cheap to redo).

### Ownership checks on delete-by-ID

Any function that accepts an `Id<"tableName">` from the client (e.g. `removeFromPantry({ id })`) must verify ownership before mutating:

```ts
const userId = await requireUserId(ctx);
const item = await ctx.db.get(args.id);
if (!item) return;  // silent no-op for unknown IDs (don't leak existence)
if (item.userId !== userId) throw new Error("Forbidden");
await ctx.db.delete(args.id);
```

### Client-side query gating — use `useAuthedUser`

The hook `hooks/useAuthedUser.ts` combines Clerk's loaded state with Convex's JWT-attached state. **Always use it** to gate `useQuery` calls against auth-required Convex functions:

```tsx
import { useAuthedUser } from "@/hooks/useAuthedUser";

const { user, isReady } = useAuthedUser();
const data = useQuery(api.foo.bar, isReady ? {} : "skip");
```

If you use `useUser()` alone (`isLoaded && user`), you'll hit the race where the query fires before `ConvexProviderWithClerk` has forwarded the JWT — server throws `"Not authenticated"`, effect doesn't retry.

For mutations, gate the handler on `user` directly (don't block the whole UI on auth readiness):

```tsx
async function handleAdd() {
  if (!user) return;  // cheap guard
  await addToPantry({ name });
}
```

### Server components / API routes — forward the JWT

Server-side Convex access from Next.js must forward the Clerk JWT, or Convex's `requireUserId` throws:

```ts
// app/results/[id]/page.tsx (Server Component)
import { fetchQuery } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";

const { getToken } = await auth();
const token = await getToken({ template: "convex" });
const data = token
  ? await fetchQuery(api.recipes.getRecipeSet, { recipeSetId }, { token })
  : null;
```

Same pattern for `fetchMutation` in API routes (see `app/api/generate-recipes/route.ts`).

### Protected routes

1. **Middleware** (`middleware.ts`): declare public routes explicitly in the `createRouteMatcher` list. Everything else requires auth — middleware redirects unauth'd visits to `/sign-in`.
2. **`AuthGuard`** (`components/AuthGuard.tsx`): wraps client pages for a nicer loading UX (spinner while Clerk loads, client-side redirect if no user). Middleware already handles the hard boundary; `AuthGuard` is for the loading window.

Protected pages should be wrapped: `/favourites`, `/my-chefs`, `/my-pantry`, `/my-shopping-list`, `/chef-results`. Add the wrapper when adding a new protected route.

### Schema: `userId` column = Clerk user ID string

Every user-owned table stores `userId: v.string()` (the Clerk user ID like `"user_3CTg..."`). Indexes are named `by_user`, `by_user_and_X` etc. **Never use `sessionId`** — that was the pre-auth anonymous pattern and is fully removed. There is intentionally no `users` table (Clerk is the source of truth for identity).

### Clerk setup that must exist in the Clerk dashboard

- **JWT template named `convex`** (Configure → JWT templates → Convex preset). Without it, `getToken({ template: "convex" })` returns null and nothing auth'd works. New Clerk instances (production) need this configured separately. Failure mode when missing: API route logs `Error: e: Not Found ... clerkError: true, status: 404`.
- **Email lockdown** (recommended): Users & Authentication → Email, Phone, Username → disable "Users can add email addresses" so users can't change their login email. Our code keys on Clerk user ID (stable), but downstream Stripe / notifications might cache email.

### Deployment: Vercel + Convex env var wiring

There are three env var surfaces and they are not interchangeable. Getting this wrong produces a cascade of specific failure modes documented below.

**Vercel env vars** (Project Settings → Environment Variables, Project tab):
- `NEXT_PUBLIC_CONVEX_URL` (All Environments) — managed by the Vercel Convex integration; it rewrites this to the ephemeral preview deployment URL per PR.
- `CONVEX_DEPLOY_KEY` — **two separate entries**: one scoped to **Production** with the Production Deploy Key, another scoped to **Preview** with a **Preview Deploy Key** (generated in Convex → Project Settings → Preview Deploy Keys). Convex rejects a production key in non-production builds — they must be different keys.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Preview + Production (safe to expose)
- `CLERK_SECRET_KEY` — Preview + Production (mark Sensitive)
- `ANTHROPIC_API_KEY` — Preview + Production (Sensitive). Used by `app/api/generate-recipes/route.ts`. Can also live in Shared env vars if managed at team level.

Do **not** scope these to Development in Vercel — that scope is for `vercel dev` CLI, which we don't use. Local dev uses `.env.local`.

**Convex Default Environment Variables** (Project Settings → Environment Variables → Default Environment Variables): these are applied when Convex creates a **new** deployment (including every preview deployment spun up by `CONVEX_DEPLOY_KEY` at build time). Existing deployments are not updated retroactively — push a new commit to trigger a fresh preview. Required defaults (check all three deployment types — Production, Preview, Development):
- `CLERK_JWT_ISSUER_DOMAIN` — exactly the Issuer URL from the Clerk JWT template (no trailing slash)
- `ANTHROPIC_API_KEY`
- `YOUTUBE_API_KEY`

**Per-deployment Convex env vars** (`npx convex env set ... --prod` or dashboard → deployment → Environment Variables): override defaults for a specific deployment. Only needed if production should use different keys than dev.

**Standard failure modes and their error messages:**
- `✖ CONVEX_DEPLOY_KEY ... not set` → Preview scope missing the key
- `✖ Detected a non-production build environment and "CONVEX_DEPLOY_KEY" for a production Convex deployment` → you put the Production key in Preview scope; generate a Preview Deploy Key instead
- `✖ Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set` → missing from Convex Default Env Vars (or the preview deployment was created before defaults were added)
- `[generate-recipes] Error: e: Not Found ... clerkError: true, status: 404` → Clerk JWT template `convex` not configured in the Clerk dashboard

### Anonymous data migration

**None. There are no anonymous users.** Pre-auth, the app used an anonymous `sessionId` keyed in localStorage. When Clerk auth was added (PR #46), all user-owned Convex tables were renamed `sessionId → userId` and the dev-mode Convex data was wiped. This was a pre-launch decision with zero real users at stake. If you re-introduce any anonymous path (e.g. a public demo), design the migration up front — don't bolt it on later.

### Reference

The pattern was established in PR #46 (commits `7fa2829`..`88a27e3`). Before any new auth-touching code, read `convex/auth.ts`, `hooks/useAuthedUser.ts`, and `components/AuthGuard.tsx`.

## Plan Document Conventions

Every implementation plan must start with:
```
# [Feature Name] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [One sentence]
**Architecture:** [2-3 sentences]
**Tech Stack:** [Key technologies]
```

Each task in a plan specifies: files to create/modify/test, exact step-by-step instructions with code, exact commands with expected output, and a commit step.

## Skill Reference

| Skill | When to use |
|-------|-------------|
| `/brainstorming` | Before any creative work — features, components, behavior changes |
| `/writing-plans` | After design approval, before touching code |
| `/executing-plans` | To implement a saved plan with checkpoints |
| `/verification-before-completion` | Before claiming anything is done, fixed, or passing |
| `/systematic-debugging` | On any bug, test failure, or unexpected behavior |

## Lessons Learned

### Convex backend changes require `npx convex dev` to sync
Changes to `convex/*.ts` files are not picked up by the Next.js dev server alone. The Convex dev server (`npx convex dev`) must be running in a separate terminal to push backend changes to the Convex environment. Without it, the app will use the last-deployed version of the backend functions. Always verify `npx convex dev` is running before testing backend changes locally.

### Type shape changes need localStorage migration
When changing a shared type that flows through localStorage (e.g. `ChefVideoResult.video?` → `videos[]`), existing users will have stale data in their browser. Always add a normalization step when reading from localStorage to convert the old shape to the new one — otherwise returning users see broken results.

### YouTube API can return more results than maxResults (resolved 2026-03-14)
The YouTube Data API v3 Search endpoint intermittently returns more items than the `maxResults` parameter requests. A user reported ~28 videos from a single chef despite `maxResults=3`. Fixed by adding a defensive `.slice(0, 3)` on the server-side response in `convex/chefs.ts`. Always clamp API results server-side — never trust external APIs to honour their own documented limits.

### E2E tests must use stable, unambiguous locators
After adding a features section with testimonial text mentioning chef names (e.g. "Recipes inspired by Gordon Ramsay"), E2E tests using `getByText("Gordon Ramsay")` broke due to strict mode violations (2 matching elements). Fix: use `getByRole("button", { name: /Gordon Ramsay/i }).first()` to target the chef grid button specifically. Similarly, after refactoring from a visible navbar to a collapsible sidebar, tests that clicked sidebar nav buttons failed because elements were off-screen. Fix: navigate directly via URL (e.g. `/?tab=chefs-table`) or test the target page directly (e.g. `/my-chefs`) instead of relying on UI navigation that may not be visible.

### Duplicated logic across Convex and lib/ must stay in sync
Convex backend functions run in an isolated environment and cannot import from Next.js `lib/`. For the pantry feature, normalization logic (`normalizeName`, `depluralise`, `classifyCategory`) is duplicated in three files: `lib/pantryUtils.ts`, `convex/pantry.ts`, and `convex/shoppingList.ts`. When a bug was found in depluralization (-oes/-ies/-ves handling), it had to be fixed in all three copies. Always grep for the function name across all three files before considering a normalization fix complete.

### Stemming rules must be validated against cooking ingredients (resolved 2026-03-20)
Generic English stemming rules can mishandle cooking ingredients. The `-ves → f` rule (halves→half) incorrectly stems "olives"→"olf" and "chives"→"chf". The `-ses` rule (intended for words like "classes") incorrectly stems "sauces"→"sauc". Fix: removed both rules — these words fall through to the generic `s`-stripping rule and produce correct results (olive, chive, sauce). When adding stemming rules, always test against common cooking ingredient names, not just general English words.

### Keyword containment classification needs a blocklist for common words
The pantry `classifyCategory()` function uses keyword containment (e.g. "tomato paste" contains "tomato" → sauces). This caused "tomato" itself to be classified as sauces, and "onion" as spices (via "onion powder"). Fix: added a `PRODUCE` set (~50 fruits/vegetables) checked before keyword containment — produce always returns "other". When adding keyword-based classification, always consider whether the base word itself is a valid standalone input that shouldn't match.

### Prompt parity discipline (learned 2026-04-16)
When modifying code that contains LLM prompts, preserve the production prompt text word for word. Do not add, remove, or rephrase instructions from memory — read the production prompt and copy it exactly. During the recipe performance optimization, "Return only valid JSON, no markdown or explanation" was added to a system message despite the production prompt already containing "No other text." This changed the prompt sent to Claude without the user's knowledge. Always diff the prompt text against production after any change.

### Convex actions add network latency to external API calls (learned 2026-04-16)
Convex actions route through Convex's infrastructure when calling external APIs (Anthropic, YouTube, etc.). For the recipe generation flow, this added ~12 seconds of latency compared to calling Anthropic directly from a Next.js API route (~28s vs ~40s). For latency-sensitive flows with long-running API calls, consider a Next.js API route with `ConvexHttpClient` for the database save. Keep the Convex action as a fallback.

### Haiku lacks regional cuisine knowledge (learned 2026-04-16)
Claude Haiku 4.5 generates structured recipe data quickly (~3x faster than Sonnet) but lacks cultural and regional nuance. It suggested rotis with South Indian dishes and missed cuisine-specific accompaniments. For recipe content that needs cultural accuracy, Sonnet is required. Haiku is suitable for purely mechanical tasks (shopping list derivation, structured data extraction) but not for content that requires regional knowledge.

### Clerk + Convex auth has a two-stage ready state (learned 2026-04-18)
`useUser()` from Clerk becomes `{ user, isLoaded: true }` before `ConvexProviderWithClerk` has forwarded the JWT to the Convex client. If a `useQuery` gates on `isLoaded && user`, it fires too early and the server throws `"Not authenticated"`. Fix: gate on `useAuthedUser().isReady`, which checks `isLoaded && user && useConvexAuth().isAuthenticated`. See the Auth Architecture section above. Also: `useQuery(..., "skip")` does NOT retry on dep changes — if the query is skipped because auth isn't ready, you must include `isReady` in the conditional so it re-fires once auth attaches.

### Convex queries trusted client userId arg (security bug, learned 2026-04-18)
The first Clerk auth PR accepted `userId: v.string()` as a client-supplied argument on every user-owned query/mutation. A signed-in user could pass another user's ID and read/write their data. Root cause: we were treating Convex auth as "wrap `useQuery` in `isLoaded ? {...} : 'skip'`" — really it must be derived from `ctx.auth.getUserIdentity()` server-side. Fixed by introducing `requireUserId(ctx)` and removing `userId` from every public query/mutation args. **Never pass `userId` from client to a Convex function.** The server decides who the caller is.

### Preview deployments need their own Convex Deploy Key + env var defaults (learned 2026-04-18)
First Preview deploy of PR #46 failed through four sequential env-var errors, each revealing the next layer:
1. `CONVEX_DEPLOY_KEY` was scoped Production-only → preview build couldn't deploy Convex.
2. Added Production key to Preview scope → Convex refused: *"Detected a non-production build environment and CONVEX_DEPLOY_KEY for a production Convex deployment."* Convex requires a **Preview Deploy Key** (generated in Project Settings → Preview Deploy Keys), scoped to Preview only, as a separate Vercel entry from the Production key.
3. Fresh preview Convex deployment created successfully but `convex/auth.config.ts` errored: *"Environment variable CLERK_JWT_ISSUER_DOMAIN is used in auth config file but its value was not set."* Preview deployments start empty — env vars must be configured as **Default Environment Variables** at the Convex project level. Add all three (`CLERK_JWT_ISSUER_DOMAIN`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`) with Prod/Preview/Dev all checked. **Existing deployments are not updated retroactively** — push a new commit to the PR to spin up a fresh preview that inherits the defaults.
4. Auth worked, but recipe generation returned `[generate-recipes] Error: e: Not Found ... clerkError: true, status: 404`. Root cause: the Clerk **JWT template named `convex`** didn't exist in the Clerk dashboard. `getToken({ template: "convex" })` 404s silently from the server's perspective — the API route bubbles it as 500. Fix: Clerk → Configure → JWT templates → New template → **Convex** preset → name it exactly `convex`. No redeploy needed.

**Future preview deploys that fail:** check these in order. The error messages are specific enough to diagnose without reading code.

### OAuth collapses sign-in and sign-up into one flow (learned 2026-04-18)
For consumer apps that lead with Google / SSO as the primary auth path, showing separate "Sign in" and "Sign up" CTAs at the top level signals a distinction that doesn't exist in practice — Clerk (and most IDPs) auto-create accounts on first OAuth sign-in. Users click the two buttons interchangeably. PR #50 consolidated them into a single orange "Log in" pill; Clerk's `<SignIn>` card surfaces "Don't have an account? Sign up" as a footer link for first-time users, so the affordance isn't lost. Default to one CTA for consumer OAuth apps. Dual CTAs (optimized for conversion) only matter at scale — pre-launch and low-traffic products get simplicity wins.

### Mobile tap targets need 48px minimum; `py-3` is the default (learned 2026-04-18)
Apple HIG requires 44×44pt; Material Design requires 48×48dp. `text-sm` (line-height 20px) + `py-2` (16px total) = **36px tall** — below both guidelines. Use `py-3` (48px total height with text-sm) for any pill / button that could be hit on mobile, especially one pinned to screen edges where mis-taps cluster. Canonical example in this repo: the auth CTA in `components/ClientNav.tsx` and the empty-state CTA in `components/FavouritesGrid.tsx:39`.

### Save before auth redirect — saveSearchState must pair with matching restore (learned 2026-04-18)
If a signed-out user is mid-flow and we redirect them to `/sign-in`, their work must survive the round-trip. Pattern in `components/HomePage.tsx`: call `saveSearchState({ activeTab, ingredientText, filters })` immediately before `router.push("/sign-in")`. The mount `useEffect` on the same page reads `loadSearchState()` and rehydrates. sessionStorage is tab-scoped, so it survives the Clerk OAuth redirect to Google and back. **Critical gotcha discovered in PR #51 code review:** saving a field that isn't also restored is a silent bug. PR #51's first iteration saved `activeTab` but the restore effect only called `setFilters` and `setInitialText` — a Chef's Table user submitting and returning would silently land on the default tab. Always mirror every save field in the restore block. Photo uploads (base64) are intentionally excluded — too large for sessionStorage; re-upload is cheap.
