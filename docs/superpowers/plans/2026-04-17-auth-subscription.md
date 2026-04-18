# Auth + Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk authentication (Google + email/password) and two-tier Stripe subscription billing ($2/mo Basic, $3/mo Chef) to Fridge to Table, replacing the anonymous sessionId system entirely.

**Architecture:** Clerk handles auth via `<ClerkProvider>` + `ConvexProviderWithClerk` wrapping the app. Convex validates Clerk JWTs and every backend function uses `ctx.auth.getUserIdentity()` instead of a `sessionId` string. Stripe Checkout handles payment collection; Stripe webhooks hit a Convex HTTP endpoint to update subscription status. A `users` table tracks subscription state; a `searchUsage` table enforces 20-search/5hr rate limiting. Feature gating (Basic vs Chef) is enforced both in the UI and server-side.

**Tech Stack:** Next.js 16, Convex, Clerk (`@clerk/nextjs`), Stripe (`stripe`), Tailwind CSS

**Design spec:** `docs/superpowers/specs/2026-04-16-auth-subscription-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `convex/auth.config.ts` | Clerk auth configuration for Convex |
| `convex/users.ts` | User CRUD, subscription helpers, first-100 counter, getOrCreateUser |
| `convex/searchUsage.ts` | Rate limit tracking — record search, check limit, get reset time |
| `convex/stripe.ts` | Create Stripe Checkout sessions (action) |
| `convex/http.ts` | Stripe webhook HTTP endpoint |
| `middleware.ts` | Clerk auth middleware — public vs protected routes |
| `lib/auth.ts` | Shared auth helper for Convex functions (getUserOrThrow) |
| `app/sign-in/[[...sign-in]]/page.tsx` | Custom sign-in page with Fridge to Table branding |
| `app/sign-up/[[...sign-up]]/page.tsx` | Custom sign-up page (same component, sign-up tab active) |
| `app/pricing/page.tsx` | Two-tier pricing page matching mockup |
| `app/settings/page.tsx` | Settings page — profile, payment, subscription, cancel |
| `components/AuthPage.tsx` | Shared sign-in/sign-up form component (tabbed, Google + email) |
| `components/SubscriptionGuard.tsx` | Wraps protected pages — checks subscription status, shows paywall |
| `components/PaywallScreen.tsx` | Hard lock screen for expired/cancelled subscriptions |
| `components/PricingCards.tsx` | Two-tier plan cards component (used on /pricing and paywall) |

### Modified Files
| File | Change |
|------|--------|
| `package.json` | Add `@clerk/nextjs`, `stripe`, `svix` |
| `convex/schema.ts` | Add `users`, `searchUsage` tables; change `sessionId` → `userId` on all 5 existing tables |
| `components/ConvexClientProvider.tsx` | Switch to `ConvexProviderWithClerk` with Clerk auth token |
| `app/layout.tsx` | Wrap with `<ClerkProvider>` |
| `convex/recipes.ts` | Replace `sessionId` with auth-based `userId` |
| `convex/favourites.ts` | Replace `sessionId` with auth-based `userId` |
| `convex/customChefs.ts` | Replace `sessionId` with auth-based `userId` |
| `convex/pantry.ts` | Replace `sessionId` with auth-based `userId` |
| `convex/shoppingList.ts` | Replace `sessionId` with auth-based `userId` |
| `convex/photos.ts` | Add plan gate (Chef only) |
| `convex/chefs.ts` | Add plan gate (Chef only) |
| `app/api/generate-recipes/route.ts` | Add Clerk auth check + rate limit |
| `components/HomePage.tsx` | Replace `getSessionId()` with Clerk `useUser()`, gate Chef's Table for Basic, disable inputs when logged out |
| `components/ClientNav.tsx` | Add Sign In/Sign Up buttons (logged out) and `<UserButton>` (logged in) |
| `components/Sidebar.tsx` | Add Settings link, gate Chef-only nav items |
| `components/FavouriteButton.tsx` | Replace `getSessionId()` with auth |
| `components/FavouritesGrid.tsx` | Replace `getSessionId()` with auth |
| `components/PantryPage.tsx` | Replace `getSessionId()` with auth |
| `components/ShoppingListPage.tsx` | Replace `getSessionId()` with auth |
| `components/RecipeIngredientsList.tsx` | Replace `getSessionId()` with auth |
| `components/RecipeShoppingCard.tsx` | Replace `getSessionId()` with auth |
| `components/IngredientInput.tsx` | Hide photo button for Basic users |
| `app/my-chefs/page.tsx` | Replace `getSessionId()` with auth |

### Deleted Files
| File | Reason |
|------|--------|
| `lib/session.ts` | Replaced by Clerk auth |
| `components/BottomNav.tsx` | Unused legacy component |
| `components/Navbar.tsx` | Unused legacy component |

---

## Task 1: Create Feature Branch and Install Packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Create feature branch**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table
git checkout -b feature/auth-subscription
```

- [ ] **Step 2: Install Clerk, Stripe, and Svix packages**

```bash
npm install @clerk/nextjs stripe svix
```

`@clerk/nextjs` — Clerk auth for Next.js (provider, middleware, hooks, components).
`stripe` — Stripe Node.js SDK for creating checkout sessions and managing subscriptions server-side.
`svix` — Webhook signature verification (used by Clerk/Stripe webhook handlers).

- [ ] **Step 3: Verify installation**

Run: `npm ls @clerk/nextjs stripe svix`
Expected: All three packages listed with versions, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @clerk/nextjs, stripe, and svix packages"
```

---

## Task 2: Convex Auth Config

**Files:**
- Create: `convex/auth.config.ts`

- [ ] **Step 1: Create the Convex auth config file**

This tells Convex how to validate Clerk JWTs. The `domain` must match the Clerk instance URL (set in Clerk dashboard → API Keys).

```typescript
// convex/auth.config.ts
const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};

export default authConfig;
```

- [ ] **Step 2: Commit**

```bash
git add convex/auth.config.ts
git commit -m "feat: add Convex auth config for Clerk JWT validation"
```

---

## Task 3: Update Schema — New Tables + sessionId → userId

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Rewrite the schema**

Replace the entire `convex/schema.ts` with the updated schema. All five existing tables change `sessionId: v.string()` to `userId: v.string()` (Clerk user ID string, not a Convex ID ref — since users are created asynchronously via webhook, we use the Clerk ID string directly). Two new tables are added: `users` and `searchUsage`.

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("basic"), v.literal("chef"))),
    stripePriceId: v.optional(v.string()),
    subscriptionStatus: v.string(),
    trialEndsAt: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_stripe_customer_id", ["stripeCustomerId"])
    .index("by_plan", ["plan"]),

  searchUsage: defineTable({
    userId: v.string(),
    searchedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_time", ["userId", "searchedAt"]),

  recipes: defineTable({
    userId: v.string(),
    ingredients: v.array(v.string()),
    filters: v.object({
      cuisine: v.string(),
      maxCookingTime: v.number(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      ),
      diet: v.optional(v.union(
        v.literal("vegetarian"),
        v.literal("vegan"),
        v.literal("non-vegetarian")
      )),
    }),
    results: v.array(v.any()),
    generatedAt: v.number(),
  }).index("by_user", ["userId"]),

  favourites: defineTable({
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
    savedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_recipe", ["userId", "recipeSetId", "recipeIndex"]),

  customChefs: defineTable({
    userId: v.string(),
    chefs: v.array(
      v.object({
        channelId: v.string(),
        channelName: v.string(),
        channelThumbnail: v.string(),
        addedAt: v.number(),
        resolvedAt: v.number(),
      })
    ),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  pantryItems: defineTable({
    userId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    category: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "normalizedName"]),

  shoppingListItems: defineTable({
    userId: v.string(),
    name: v.string(),
    normalizedName: v.string(),
    source: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "normalizedName"]),
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: update schema — add users and searchUsage tables, replace sessionId with userId"
```

---

## Task 4: Auth Helper for Convex Functions

**Files:**
- Create: `lib/auth.ts`

- [ ] **Step 1: Create the auth helper**

This helper is used by every Convex query/mutation to get the authenticated user's Clerk ID. It throws if the user is not authenticated, which Convex surfaces as an error to the client.

```typescript
// lib/auth.ts
import { QueryCtx, MutationCtx, ActionCtx } from "../convex/_generated/server";

export async function getAuthUserId(
  ctx: QueryCtx | MutationCtx | ActionCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  // Clerk's subject is the user ID (e.g., "user_2abc...")
  return identity.subject;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: add getAuthUserId helper for Convex functions"
```

---

## Task 5: Users Table — Convex Functions

**Files:**
- Create: `convex/users.ts`

- [ ] **Step 1: Create the users module**

This module handles user creation (on first sign-in), subscription status lookups, and the first-100 Chef subscriber counter.

```typescript
// convex/users.ts
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Get user by Clerk ID — used by components to check subscription status
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get or create user — called after Clerk sign-up/sign-in
export const getOrCreateUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Update profile fields if changed
      await ctx.db.patch(existing._id, {
        email: args.email,
        firstName: args.firstName,
        lastName: args.lastName,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      subscriptionStatus: "none",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Count Chef plan subscribers (for first-100 pricing)
export const getChefSubscriberCount = query({
  args: {},
  handler: async (ctx) => {
    const chefUsers = await ctx.db
      .query("users")
      .withIndex("by_plan", (q) => q.eq("plan", "chef"))
      .collect();
    // Only count active/trialing subscribers
    return chefUsers.filter(
      (u) => u.subscriptionStatus === "active" || u.subscriptionStatus === "trialing"
    ).length;
  },
});

// Update subscription status — called by Stripe webhook handler
export const updateSubscription = internalMutation({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.union(v.literal("basic"), v.literal("chef"))),
    stripePriceId: v.optional(v.string()),
    subscriptionStatus: v.string(),
    trialEndsAt: v.optional(v.number()),
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
      console.error("[updateSubscription] No user found for Stripe customer:", args.stripeCustomerId);
      return;
    }

    await ctx.db.patch(user._id, {
      stripeSubscriptionId: args.stripeSubscriptionId ?? user.stripeSubscriptionId,
      plan: args.plan ?? user.plan,
      stripePriceId: args.stripePriceId ?? user.stripePriceId,
      subscriptionStatus: args.subscriptionStatus,
      trialEndsAt: args.trialEndsAt ?? user.trialEndsAt,
      currentPeriodEnd: args.currentPeriodEnd ?? user.currentPeriodEnd,
      updatedAt: Date.now(),
    });
  },
});

// Set Stripe customer ID — called after Checkout session completion
export const setStripeCustomerId = internalMutation({
  args: {
    clerkId: v.string(),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      console.error("[setStripeCustomerId] No user found for Clerk ID:", args.clerkId);
      return;
    }

    await ctx.db.patch(user._id, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

// Update user profile — called from Settings page
export const updateProfile = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    await ctx.db.patch(user._id, {
      firstName: args.firstName,
      lastName: args.lastName,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/users.ts
git commit -m "feat: add users Convex module — CRUD, subscription helpers, first-100 counter"
```

---

## Task 6: Rate Limiting — Convex Functions

**Files:**
- Create: `convex/searchUsage.ts`

- [ ] **Step 1: Create the search usage module**

Enforces 20 searches per rolling 5-hour window. Used by the recipe generation API route before calling Claude.

```typescript
// convex/searchUsage.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const MAX_SEARCHES = 20;
const WINDOW_MS = 5 * 60 * 60 * 1000; // 5 hours

// Check if user can search — returns { allowed, remaining, resetsAt }
export const checkLimit = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - WINDOW_MS;
    const recent = await ctx.db
      .query("searchUsage")
      .withIndex("by_user_and_time", (q) =>
        q.eq("userId", args.userId).gte("searchedAt", cutoff)
      )
      .collect();

    const count = recent.length;
    const allowed = count < MAX_SEARCHES;
    const remaining = Math.max(0, MAX_SEARCHES - count);

    // Find when the oldest search in the window expires
    let resetsAt: number | null = null;
    if (!allowed && recent.length > 0) {
      const oldest = recent.reduce((min, r) =>
        r.searchedAt < min.searchedAt ? r : min
      );
      resetsAt = oldest.searchedAt + WINDOW_MS;
    }

    return { allowed, remaining, resetsAt, used: count };
  },
});

// Record a search — called after successful recipe generation
export const recordSearch = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("searchUsage", {
      userId: args.userId,
      searchedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/searchUsage.ts
git commit -m "feat: add searchUsage module — 20 searches per 5-hour rolling window"
```

---

## Task 7: Update Convex Functions — Replace sessionId with Auth

**Files:**
- Modify: `convex/recipes.ts`
- Modify: `convex/favourites.ts`
- Modify: `convex/customChefs.ts`
- Modify: `convex/pantry.ts`
- Modify: `convex/shoppingList.ts`
- Modify: `convex/photos.ts`
- Modify: `convex/chefs.ts`

- [ ] **Step 1: Update convex/recipes.ts**

Replace `sessionId` with `userId` in all functions. The `saveRecipeSet` mutation is called from the API route which passes `userId` (the Clerk user ID) instead of `sessionId`.

In `convex/recipes.ts`, make these changes:
- `insertRecipeSet`: change `sessionId: v.string()` → `userId: v.string()`, update the insert to use `userId`
- `saveRecipeSet`: change `sessionId: v.string()` → `userId: v.string()`, update the insert to use `userId`
- `generateRecipes` action (if it exists): change `sessionId` → `userId` in args and internal mutation call

Replace every occurrence of `sessionId` with `userId` in the args validators and handler code. The `getRecipeSet` query stays unchanged (it looks up by ID, not session).

```typescript
// convex/recipes.ts — updated insertRecipeSet and saveRecipeSet
export const insertRecipeSet = internalMutation({
  args: {
    userId: v.string(),
    ingredients: v.array(v.string()),
    filters: filtersValidator,
    results: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recipes", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});

export const saveRecipeSet = mutation({
  args: {
    userId: v.string(),
    ingredients: v.array(v.string()),
    filters: filtersValidator,
    results: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recipes", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Update convex/favourites.ts**

Replace every `sessionId` with `userId` in all three functions and their filter/query calls:

```typescript
// convex/favourites.ts — all functions updated
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveFavourite = mutation({
  args: {
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (!existing) {
      await ctx.db.insert("favourites", {
        userId: args.userId,
        recipeSetId: args.recipeSetId,
        recipeIndex: args.recipeIndex,
        savedAt: Date.now(),
      });
    }
  },
});

export const removeFavourite = mutation({
  args: {
    userId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getFavourites = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favourites")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .order("desc")
      .collect();
  },
});
```

- [ ] **Step 3: Update convex/customChefs.ts**

Replace `sessionId` with `userId` in `listCustomChefs`, `addCustomChef`, and `removeCustomChef`. Update index references from `by_session` to `by_user`:

```typescript
// convex/customChefs.ts — key changes (apply to all 3 functions)
export const listCustomChefs = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!doc) return [];
    return [...doc.chefs].sort((a, b) => a.addedAt - b.addedAt);
  },
});

export const addCustomChef = mutation({
  args: {
    userId: v.string(),
    channelId: v.string(),
    channelName: v.string(),
    channelThumbnail: v.string(),
    resolvedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const newChef = {
      channelId: args.channelId,
      channelName: args.channelName,
      channelThumbnail: args.channelThumbnail,
      addedAt: Date.now(),
      resolvedAt: args.resolvedAt,
    };

    if (!doc) {
      await ctx.db.insert("customChefs", {
        userId: args.userId,
        chefs: [newChef],
        updatedAt: Date.now(),
      });
      return;
    }

    if (doc.chefs.length >= 6) {
      throw new Error("limit_reached");
    }

    if (doc.chefs.some((c) => c.channelId === args.channelId)) {
      throw new Error("duplicate");
    }

    await ctx.db.patch(doc._id, {
      chefs: [...doc.chefs, newChef],
      updatedAt: Date.now(),
    });
  },
});

export const removeCustomChef = mutation({
  args: {
    userId: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("customChefs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!doc) return;

    const filtered = doc.chefs.filter((c) => c.channelId !== args.channelId);
    if (filtered.length === doc.chefs.length) return;
    await ctx.db.patch(doc._id, {
      chefs: filtered,
      updatedAt: Date.now(),
    });
  },
});
```

The `resolveYouTubeChannel` action has no `sessionId` — leave it unchanged.

- [ ] **Step 4: Update convex/pantry.ts**

Replace `sessionId` with `userId` in `getPantryItems` and `addToPantry`. Update index references from `by_session` → `by_user` and `by_session_and_name` → `by_user_and_name`. Keep all normalization/classification logic unchanged.

```typescript
// convex/pantry.ts — key function signatures (normalization code stays the same)
export const getPantryItems = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pantryItems")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addToPantry = mutation({
  args: { userId: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const displayName = args.name.toLowerCase().trim();
    const normalized = normalizeName(args.name);

    const existing = await ctx.db
      .query("pantryItems")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", args.userId).eq("normalizedName", normalized)
      )
      .first();

    if (existing) {
      return { alreadyExists: true as const, existingId: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("pantryItems", {
      userId: args.userId,
      name: displayName,
      normalizedName: normalized,
      category: classifyCategory(normalized),
      createdAt: now,
      updatedAt: now,
    });

    return { alreadyExists: false as const, id };
  },
});
```

The `removeFromPantry` mutation takes an `id` only — no change needed.

- [ ] **Step 5: Update convex/shoppingList.ts**

Same pattern as pantry — replace `sessionId` with `userId`, update indexes:

```typescript
// convex/shoppingList.ts — key function signatures
export const getShoppingListItems = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const addToShoppingList = mutation({
  args: { userId: v.string(), name: v.string(), source: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const displayName = args.name.toLowerCase().trim();
    const normalized = normalizeName(args.name);

    const existing = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", args.userId).eq("normalizedName", normalized)
      )
      .first();

    if (existing) {
      return { alreadyExists: true as const, existingId: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("shoppingListItems", {
      userId: args.userId,
      name: displayName,
      normalizedName: normalized,
      source: args.source ?? "manual",
      createdAt: now,
      updatedAt: now,
    });

    return { alreadyExists: false as const, id };
  },
});
```

The `removeFromShoppingList` mutation takes an `id` only — no change needed.

- [ ] **Step 6: Add plan gates to convex/photos.ts and convex/chefs.ts**

For `convex/photos.ts`, add a `userId` arg and plan check at the start of the action handler. The plan check queries the `users` table to verify the user has the "chef" plan:

```typescript
// convex/photos.ts — add to the top of the handler
export const analyzePhoto = action({
  args: {
    imageBase64: v.string(),
    userId: v.string(), // NEW: Clerk user ID for plan check
  },
  handler: async (ctx, args): Promise<{ ingredients: string[]; uncertain: string[] }> => {
    // Plan gate: photo scan is Chef-only
    const { userId, ...rest } = args;
    // Note: In an action, we can't query the DB directly.
    // The plan check is done client-side and in the API route.
    // The action trusts the caller. Server-side enforcement is via the API route auth check.

    // ... rest of existing handler using rest.imageBase64 ...
```

Actually, since Convex actions can't directly query the database, the plan gate for `analyzePhoto` and `searchChefVideos` should be enforced on the frontend (hide the UI) and in the API route / component that calls these actions. The actions themselves don't need userId args — they're already only callable from authenticated contexts.

For `convex/chefs.ts` (`searchChefVideos`), same approach — no changes needed to the action itself. Feature gating is enforced in the UI (hiding Chef's Table tab for Basic users) and in `HomePage.tsx` which is the only caller.

- [ ] **Step 7: Commit**

```bash
git add convex/recipes.ts convex/favourites.ts convex/customChefs.ts convex/pantry.ts convex/shoppingList.ts convex/photos.ts convex/chefs.ts
git commit -m "feat: replace sessionId with userId across all Convex functions"
```

---

## Task 8: Stripe Integration — Checkout Sessions + Webhooks

**Files:**
- Create: `convex/stripe.ts`
- Create: `convex/http.ts`

- [ ] **Step 1: Create the Stripe checkout action**

This Convex action creates a Stripe Checkout Session and returns the URL. Called from the pricing page when a user clicks "Get started" or "Get Chef plan".

```typescript
// convex/stripe.ts
"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-04-30.basil",
});

export const createCheckoutSession = action({
  args: {
    clerkId: v.string(),
    email: v.string(),
    priceId: v.string(),
    plan: v.union(v.literal("basic"), v.literal("chef")),
  },
  handler: async (_ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: args.email,
      line_items: [{ price: args.priceId, quantity: 1 }],
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/pricing`,
      metadata: {
        clerkId: args.clerkId,
        plan: args.plan,
      },
    };

    // Chef plan gets 7-day free trial
    if (args.plan === "chef") {
      sessionConfig.subscription_data = {
        trial_period_days: 7,
        metadata: {
          clerkId: args.clerkId,
          plan: args.plan,
        },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);
    return { url: session.url };
  },
});

// Create a Stripe Customer Portal session for managing payment methods
export const createPortalSession = action({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (_ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: args.stripeCustomerId,
      return_url: `${baseUrl}/settings`,
    });
    return { url: session.url };
  },
});

// Cancel subscription at period end
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (_ctx, args) => {
    await stripe.subscriptions.update(args.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  },
});
```

- [ ] **Step 2: Create the Stripe webhook HTTP endpoint**

This Convex HTTP route receives Stripe webhook events, verifies the signature, and updates the user's subscription status.

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import Stripe from "stripe";

const http = httpRouter();

http.route({
  path: "/stripe-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-04-30.basil",
    });

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return new Response("Webhook signature verification failed", { status: 400 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const clerkId = session.metadata?.clerkId;
        const plan = session.metadata?.plan as "basic" | "chef" | undefined;

        if (clerkId && session.customer) {
          // Link Stripe customer to our user
          await ctx.runMutation(internal.users.setStripeCustomerId, {
            clerkId,
            stripeCustomerId: session.customer as string,
          });

          // Retrieve subscription details
          if (session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            await ctx.runMutation(internal.users.updateSubscription, {
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: subscription.id,
              plan: plan ?? "basic",
              stripePriceId: subscription.items.data[0]?.price.id,
              subscriptionStatus: subscription.status === "trialing" ? "trialing" : "active",
              trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
              currentPeriodEnd: subscription.current_period_end * 1000,
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const plan = subscription.metadata?.plan as "basic" | "chef" | undefined;

        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          stripeSubscriptionId: subscription.id,
          plan,
          stripePriceId: subscription.items.data[0]?.price.id,
          subscriptionStatus: subscription.cancel_at_period_end
            ? "cancelled"
            : subscription.status === "trialing"
              ? "trialing"
              : subscription.status === "active"
                ? "active"
                : subscription.status,
          trialEndsAt: subscription.trial_end ? subscription.trial_end * 1000 : undefined,
          currentPeriodEnd: subscription.current_period_end * 1000,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await ctx.runMutation(internal.users.updateSubscription, {
          stripeCustomerId: subscription.customer as string,
          subscriptionStatus: "cancelled",
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer && invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: invoice.customer as string,
            subscriptionStatus: "active",
            currentPeriodEnd: subscription.current_period_end * 1000,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await ctx.runMutation(internal.users.updateSubscription, {
            stripeCustomerId: invoice.customer as string,
            subscriptionStatus: "past_due",
          });
        }
        break;
      }
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
```

- [ ] **Step 3: Commit**

```bash
git add convex/stripe.ts convex/http.ts
git commit -m "feat: add Stripe checkout sessions and webhook handler"
```

---

## Task 9: Clerk Provider + Convex Integration

**Files:**
- Modify: `components/ConvexClientProvider.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update ConvexClientProvider to use Clerk auth**

Replace the simple `ConvexProvider` with `ConvexProviderWithClerk` which passes the Clerk auth token to Convex for JWT validation.

```typescript
// components/ConvexClientProvider.tsx
"use client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";
import { useAuth } from "@clerk/nextjs";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}
```

- [ ] **Step 2: Wrap app layout with ClerkProvider**

Add `<ClerkProvider>` to `app/layout.tsx`, wrapping the entire app. It must be outside `ConvexClientProvider` since Convex needs Clerk's auth context.

In `app/layout.tsx`, add the import and wrap:

```typescript
// app/layout.tsx — add import
import { ClerkProvider } from "@clerk/nextjs";

// In the return, wrap everything with ClerkProvider:
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} ${outfit.variable} antialiased bg-[#FAF6F1]`}>
          <ConvexClientProvider>
            <ClientNav>{children}</ClientNav>
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/ConvexClientProvider.tsx app/layout.tsx
git commit -m "feat: integrate Clerk provider with Convex auth"
```

---

## Task 10: Clerk Middleware

**Files:**
- Create: `middleware.ts` (in project root)

- [ ] **Step 1: Create the middleware file**

Clerk's middleware protects routes. Public routes (homepage, auth pages, pricing, Convex internal routes) are accessible without auth. Everything else requires sign-in.

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat: add Clerk auth middleware with public/protected routes"
```

---

## Task 11: Custom Sign-In / Sign-Up Pages

**Files:**
- Create: `components/AuthPage.tsx`
- Create: `app/sign-in/[[...sign-in]]/page.tsx`
- Create: `app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create the shared AuthPage component**

This is a custom-styled auth form matching the mockup — Fridge to Table logo, tabbed Sign in / Sign up toggle, Google OAuth button, email/password fields.

```typescript
// components/AuthPage.tsx
"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();

  const isLoaded = signInLoaded && signUpLoaded;

  async function handleGoogleAuth() {
    if (!isLoaded) return;
    setError(null);

    try {
      if (mode === "sign-in") {
        await signIn!.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sign-in/sso-callback",
          redirectUrlComplete: "/pricing",
        });
      } else {
        await signUp!.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sign-up/sso-callback",
          redirectUrlComplete: "/pricing",
        });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Something went wrong");
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "sign-in") {
        const result = await signIn!.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          await signIn!.setActive({ session: result.createdSessionId });
          router.push("/");
        }
      } else {
        const result = await signUp!.create({
          emailAddress: email,
          password,
        });

        if (result.status === "missing_requirements") {
          // Email verification needed
          await signUp!.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setPendingVerification(true);
        } else if (result.status === "complete") {
          await signUp!.setActive({ session: result.createdSessionId });
          router.push("/pricing");
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signUp!.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await signUp!.setActive({ session: result.createdSessionId });
        router.push("/pricing");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? "Invalid verification code");
    } finally {
      setLoading(false);
    }
  }

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <Link href="/" className="text-2xl font-bold text-[#1A3A2A] font-[var(--font-playfair)]">
              fridge to table
            </Link>
          </div>

          <h2 className="text-lg font-semibold text-gray-800 text-center mb-2">
            Check your email
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            We sent a verification code to {email}
          </p>

          <form onSubmit={handleVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter code"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify email"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-[#1A3A2A] font-[var(--font-playfair)]">
            fridge to table
          </Link>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 text-center mb-6">
          {mode === "sign-in" ? "Sign in to your account" : "Create your account"}
        </h2>

        {/* Tab toggle */}
        <div className="flex rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode("sign-in"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "sign-in"
                ? "bg-[#1A3A2A] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("sign-up"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "sign-up"
                ? "bg-[#1A3A2A] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
          >
            {loading
              ? (mode === "sign-in" ? "Signing in..." : "Creating account...")
              : (mode === "sign-in" ? "Sign in" : "Sign up")}
          </button>
        </form>

        {/* Forgot password */}
        {mode === "sign-in" && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError("Enter your email address first");
                  return;
                }
                try {
                  await signIn!.create({
                    strategy: "reset_password_email_code",
                    identifier: email,
                  });
                  setError("Check your email for a password reset link");
                } catch (err: any) {
                  setError(err.errors?.[0]?.message ?? "Could not send reset email");
                }
              }}
              className="text-sm text-[#D4622A] hover:underline"
            >
              Forgot password?
            </button>
          </div>
        )}

        {/* Terms footer */}
        <p className="text-xs text-gray-400 text-center mt-6">
          By continuing you agree to our{" "}
          <span className="underline">Terms</span> and{" "}
          <span className="underline">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create sign-in page**

```typescript
// app/sign-in/[[...sign-in]]/page.tsx
import { AuthPage } from "@/components/AuthPage";

export default function SignInPage() {
  return <AuthPage initialMode="sign-in" />;
}
```

- [ ] **Step 3: Create sign-up page**

```typescript
// app/sign-up/[[...sign-up]]/page.tsx
import { AuthPage } from "@/components/AuthPage";

export default function SignUpPage() {
  return <AuthPage initialMode="sign-up" />;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/AuthPage.tsx app/sign-in app/sign-up
git commit -m "feat: add custom sign-in and sign-up pages with Fridge to Table branding"
```

---

## Task 12: Pricing Page

**Files:**
- Create: `components/PricingCards.tsx`
- Create: `app/pricing/page.tsx`

- [ ] **Step 1: Create the PricingCards component**

Matches the mockup — two-tier layout with Basic and Chef cards, first-100 badge, feature lists.

```typescript
// components/PricingCards.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function PricingCards() {
  const { user } = useUser();
  const chefCount = useQuery(api.users.getChefSubscriberCount) ?? 0;
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<"basic" | "chef" | null>(null);

  const isEarlyBird = chefCount < 100;
  const chefPrice = isEarlyBird ? "$3" : "$7";

  async function handleCheckout(plan: "basic" | "chef") {
    if (!user) return;
    setLoadingPlan(plan);

    try {
      const priceId =
        plan === "basic"
          ? process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID!
          : isEarlyBird
            ? process.env.NEXT_PUBLIC_STRIPE_CHEF_EARLY_PRICE_ID!
            : process.env.NEXT_PUBLIC_STRIPE_CHEF_STANDARD_PRICE_ID!;

      const result = await createCheckout({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        priceId,
        plan,
      });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {/* Top feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {["Pantry + shopping list", "Save favourite recipes", "Chef's Table videos"].map((label) => (
          <span key={label} className="flex items-center gap-2 bg-white rounded-full px-4 py-2 text-sm text-gray-600 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-[#C8DFC8]" />
            {label}
          </span>
        ))}
      </div>

      {/* Heading */}
      <h2 className="text-center text-xs font-semibold tracking-[0.2em] text-gray-500 mb-8">
        CHOOSE YOUR PLAN TO GET STARTED
      </h2>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Basic card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-1">Basic</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">
            $2<span className="text-base font-normal text-gray-500">/mo</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Everything you need to cook smarter every night.
          </p>

          <ul className="space-y-3 mb-6">
            {["Recipe search", "Pantry tracker", "Shopping list", "Save favourites", "Cooking history"].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">&#10003;</span>
                {feature}
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mb-4">Standard usage limits apply</p>

          <button
            onClick={() => handleCheckout("basic")}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loadingPlan === "basic" ? "Loading..." : "Get started"}
            {loadingPlan !== "basic" && <span className="text-xs">&#8599;</span>}
          </button>
        </div>

        {/* Chef card */}
        <div className="bg-white rounded-2xl border-2 border-[#1A3A2A] p-8 relative">
          {isEarlyBird && (
            <span className="absolute -top-3 left-6 bg-[#C8DFC8] text-[#1A3A2A] text-xs font-semibold px-3 py-1 rounded-full">
              First 100 users
            </span>
          )}

          <h3 className="text-xl font-bold text-gray-900 mb-1">Chef</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">
            {chefPrice}<span className="text-base font-normal text-gray-500">/mo</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            The full experience — scan, speak, watch and cook.
          </p>

          <ul className="space-y-3 mb-6">
            {["Everything in Basic", "Photo scan", "Chef's Table videos"].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">&#10003;</span>
                {feature}
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mb-4">
            {isEarlyBird ? "Priority access \u00b7 Standard pricing $7/mo after" : "Priority access"}
          </p>

          <button
            onClick={() => handleCheckout("chef")}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loadingPlan === "chef" ? "Loading..." : "Get Chef plan"}
            {loadingPlan !== "chef" && <span className="text-xs">&#8599;</span>}
          </button>
        </div>
      </div>

      {/* Footer note */}
      {isEarlyBird && (
        <p className="text-center text-sm text-gray-500 mt-6">
          Chef plan is <strong>$3/mo for the first 100 members</strong>, then $7/mo. Lock in your rate today.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the pricing page**

```typescript
// app/pricing/page.tsx
import { PricingCards } from "@/components/PricingCards";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <PricingCards />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PricingCards.tsx app/pricing/page.tsx
git commit -m "feat: add two-tier pricing page with early-bird Chef plan"
```

---

## Task 13: Subscription Guard + Paywall Screen

**Files:**
- Create: `components/SubscriptionGuard.tsx`
- Create: `components/PaywallScreen.tsx`

- [ ] **Step 1: Create the PaywallScreen component**

Shown when a user's subscription is expired, cancelled, or past_due. Offers plan options to resubscribe.

```typescript
// components/PaywallScreen.tsx
"use client";

import { PricingCards } from "@/components/PricingCards";

export function PaywallScreen() {
  return (
    <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-2">
          Your subscription has ended
        </h1>
        <p className="text-gray-500 mb-8">
          Choose a plan to continue cooking.
        </p>
        <PricingCards />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the SubscriptionGuard component**

Wraps protected content. Checks if the user has an active subscription. If not, shows PaywallScreen or redirects to pricing.

```typescript
// components/SubscriptionGuard.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PaywallScreen } from "@/components/PaywallScreen";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
  children: React.ReactNode;
  requiredPlan?: "basic" | "chef"; // If set, user must have this specific plan
};

export function SubscriptionGuard({ children, requiredPlan }: Props) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();

  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  // Still loading
  if (!clerkLoaded || (user && dbUser === undefined)) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Not signed in — middleware should catch this, but just in case
  if (!user) {
    router.push("/sign-in");
    return null;
  }

  // No user record yet — redirect to pricing (fresh sign-up)
  if (!dbUser) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Setting up your account...</p>
      </div>
    );
  }

  // Check subscription status
  const isActive =
    dbUser.subscriptionStatus === "active" ||
    dbUser.subscriptionStatus === "trialing";

  if (!isActive) {
    return <PaywallScreen />;
  }

  // Check plan-specific access (e.g., Chef-only features)
  if (requiredPlan && dbUser.plan !== requiredPlan) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#1A3A2A] mb-2">
            Chef plan required
          </h2>
          <p className="text-gray-500 mb-4">
            This feature is available on the Chef plan.
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="bg-[#D4622A] text-white px-6 py-3 rounded-2xl font-medium hover:bg-[#BF5525] transition-colors"
          >
            Upgrade to Chef
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Commit**

```bash
git add components/SubscriptionGuard.tsx components/PaywallScreen.tsx
git commit -m "feat: add subscription guard and paywall screen"
```

---

## Task 14: Update Components — Replace getSessionId with Auth

**Files:**
- Modify: `components/HomePage.tsx`
- Modify: `components/FavouriteButton.tsx`
- Modify: `components/FavouritesGrid.tsx`
- Modify: `components/PantryPage.tsx`
- Modify: `components/ShoppingListPage.tsx`
- Modify: `components/RecipeIngredientsList.tsx`
- Modify: `components/RecipeShoppingCard.tsx`
- Modify: `app/my-chefs/page.tsx`

In every file listed below, make the following changes:

1. Remove `import { getSessionId } from "@/lib/session";`
2. Add `import { useUser } from "@clerk/nextjs";`
3. Replace `const sessionId = getSessionId();` with:
   ```typescript
   const { user } = useUser();
   const userId = user?.id ?? "";
   ```
4. Replace every `sessionId` variable reference with `userId`
5. Replace every `{ sessionId }` object with `{ userId }`
6. Replace query skip conditions from `sessionId ? { sessionId } : "skip"` to `userId ? { userId } : "skip"`

- [ ] **Step 1: Update components/FavouriteButton.tsx**

```typescript
// components/FavouriteButton.tsx
"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  recipeSetId: string;
  recipeIndex: number;
};

export function FavouriteButton({ recipeSetId, recipeIndex }: Props) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const favourites = useQuery(api.favourites.getFavourites, userId ? { userId } : "skip");
  const saveFavourite = useMutation(api.favourites.saveFavourite);
  const removeFavourite = useMutation(api.favourites.removeFavourite);

  const isFavourited = favourites?.some(
    (f) => f.recipeSetId === recipeSetId && f.recipeIndex === recipeIndex
  );

  async function handleToggle() {
    const id = recipeSetId as Id<"recipes">;
    if (isFavourited) {
      await removeFavourite({ userId, recipeSetId: id, recipeIndex });
    } else {
      await saveFavourite({ userId, recipeSetId: id, recipeIndex });
    }
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={isFavourited ? "Remove from favourites" : "Save to favourites"}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                  border transition-colors
                  ${
                    isFavourited
                      ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                      : "bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
                  }`}
    >
      <span>{isFavourited ? "\u2665" : "\u2661"}</span>
      <span>{isFavourited ? "Saved" : "Save to Favourites"}</span>
    </button>
  );
}
```

- [ ] **Step 2: Update components/FavouritesGrid.tsx**

Apply the same pattern: replace `getSessionId` import with `useUser`, replace `sessionId` with `userId` throughout. The `removeFavourite` call changes from `{ sessionId, ... }` to `{ userId, ... }`.

- [ ] **Step 3: Update components/PantryPage.tsx**

Replace `getSessionId` with `useUser`. Change `{ sessionId }` to `{ userId }` in `getPantryItems` and `addToPantry` calls.

- [ ] **Step 4: Update components/ShoppingListPage.tsx**

Replace `getSessionId` with `useUser`. Change `{ sessionId }` to `{ userId }` in `getShoppingListItems` and `addToShoppingList` calls.

- [ ] **Step 5: Update components/RecipeIngredientsList.tsx**

Replace `getSessionId` with `useUser`. Change `{ sessionId }` to `{ userId }` in `getPantryItems` query.

- [ ] **Step 6: Update components/RecipeShoppingCard.tsx**

Replace `getSessionId` with `useUser`. Change all `{ sessionId, ... }` to `{ userId, ... }` in `addToPantry`, `addToShoppingList`, and query calls.

- [ ] **Step 7: Update app/my-chefs/page.tsx**

Replace `getSessionId` with `useUser`. Change `{ sessionId }` to `{ userId }` in `listCustomChefs`, `addCustomChef`, and `removeCustomChef` calls.

- [ ] **Step 8: Update components/HomePage.tsx**

This is the most complex component update:
1. Replace `getSessionId` import with `import { useUser } from "@clerk/nextjs";` and `import { useQuery as useConvexQuery } from "convex/react";` and `import { api } from "@/convex/_generated/api";`
2. Add `const { user } = useUser();` and `const userId = user?.id ?? "";`
3. Replace `const sessionId = getSessionId();` (line 148) with `userId`
4. In the `customChefsResult` query, change `sessionId ? { sessionId } : "skip"` to `userId ? { userId } : "skip"`
5. In the `handleSubmit` function, change the recipe generation fetch body from `{ sessionId, ... }` to `{ userId, ... }`
6. **Feature gate**: If user has Basic plan, hide the Chef's Table tab entirely. Query the user's plan from the `users` table and conditionally hide the tab.

Add these lines near the top of the component:

```typescript
const { user } = useUser();
const userId = user?.id ?? "";
const dbUser = useQuery(api.users.getByClerkId, user ? { clerkId: user.id } : "skip");
const userPlan = dbUser?.plan;
const isChefPlan = userPlan === "chef";
```

For the tab selector, hide Chef's Table if not Chef plan:

```typescript
// Only show Chef's Table tab for Chef plan users
{isChefPlan && (
  <button onClick={() => setActiveTab("chefs-table")} ...>
    Chef's Table
  </button>
)}
```

For the recipe generation fetch body:

```typescript
body: JSON.stringify({ userId, ingredients: finalIngredients, filters }),
```

- [ ] **Step 9: Commit**

```bash
git add components/FavouriteButton.tsx components/FavouritesGrid.tsx components/PantryPage.tsx components/ShoppingListPage.tsx components/RecipeIngredientsList.tsx components/RecipeShoppingCard.tsx components/HomePage.tsx app/my-chefs/page.tsx
git commit -m "feat: replace getSessionId with Clerk useUser across all components"
```

---

## Task 15: Update API Route — Auth + Rate Limiting

**Files:**
- Modify: `app/api/generate-recipes/route.ts`

- [ ] **Step 1: Add auth check and rate limit to the API route**

The API route now:
1. Validates the Clerk session via `auth()` from `@clerk/nextjs/server`
2. Checks rate limit via Convex `checkLimit` query
3. Records the search via Convex `recordSearch` mutation after success
4. Uses `userId` instead of `sessionId` for the recipe save

```typescript
// app/api/generate-recipes/route.ts
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Auth check
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ingredients, filters } = await req.json();

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Rate limit check
    const usage = await convex.query(api.searchUsage.checkLimit, { userId });
    if (!usage.allowed) {
      const resetsIn = usage.resetsAt
        ? Math.ceil((usage.resetsAt - Date.now()) / 60000)
        : 0;
      const hours = Math.floor(resetsIn / 60);
      const minutes = resetsIn % 60;
      return Response.json(
        {
          error: `You've used all 20 searches for now. Resets in ${hours > 0 ? `${hours}h ` : ""}${minutes}m.`,
          rateLimited: true,
        },
        { status: 429 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const ingredientList = ingredients.join(", ");
    const cuisineNote = filters.cuisine || "any style";

    const recipeSchema = `{
  title: string,
  description: string (1-2 sentences),
  cookingTime: number (minutes),
  difficulty: "easy" | "medium" | "hard",
  servings: number,
  cuisineType: string,
  ingredients: Array<{ name: string, amount: string, inFridge: boolean }>,
  steps: string[],
  shoppingList: string[],
  uncertainIngredients?: string[]
}`;

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a creative chef generating recipe suggestions.",
      messages: [
        {
          role: "user",
          content: `The user has these ingredients: ${ingredientList}.
Generate exactly 3 recipes using mostly these ingredients.
Cuisine style: ${cuisineNote}.
Maximum cooking time: ${filters.maxCookingTime} minutes.
Difficulty level: ${filters.difficulty}.

For each recipe:
- Set inFridge: true for ingredients the user already has
- List any additional required ingredients in shoppingList
- If you need to slightly exceed the time or difficulty to give good results,
  do so and briefly note it in the description

Return a JSON array of exactly 3 recipes. No other text. Schema for each recipe:
${recipeSchema}`,
        },
      ],
    });

    let fullText = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
      }
    }

    const text = fullText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const recipes = JSON.parse(text);

    if (!Array.isArray(recipes) || recipes.length === 0) {
      return Response.json(
        { error: "No recipes could be generated for these ingredients" },
        { status: 500 }
      );
    }

    // Save recipe set with userId instead of sessionId
    const recipeSetId = await convex.mutation(
      api.recipes.saveRecipeSet,
      { userId, ingredients, filters, results: recipes }
    );

    // Record search for rate limiting
    await convex.mutation(api.searchUsage.recordSearch, { userId });

    return Response.json({ recipeSetId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-recipes] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Update HomePage.tsx to handle rate limit response**

In `components/HomePage.tsx`, update the `handleSubmit` function to check for rate limit errors:

```typescript
// In handleSubmit, after the fetch call:
const res = await fetch("/api/generate-recipes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ingredients: finalIngredients, filters }),
});

if (res.status === 429) {
  const data = await res.json();
  setError(data.error);
  setIsLoading(false);
  return;
}

if (!res.ok) throw new Error("Recipe generation failed");
```

Note: The `userId` no longer needs to be sent in the request body — the API route gets it from the Clerk session via `auth()`.

- [ ] **Step 3: Commit**

```bash
git add app/api/generate-recipes/route.ts components/HomePage.tsx
git commit -m "feat: add auth check and rate limiting to recipe generation API"
```

---

## Task 16: Add Subscription Guards to Pages

**Files:**
- Modify: `app/favourites/page.tsx`
- Modify: `app/my-chefs/page.tsx`
- Modify: `app/chef-results/page.tsx`
- Modify: `app/my-pantry/page.tsx`
- Modify: `app/my-shopping-list/page.tsx`

Wrap each page's content with `<SubscriptionGuard>`. For Chef-only pages (my-chefs, chef-results), add `requiredPlan="chef"`.

- [ ] **Step 1: Update app/favourites/page.tsx**

```typescript
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { FavouritesGrid } from "@/components/FavouritesGrid";
import Link from "next/link";

export default function FavouritesPage() {
  return (
    <SubscriptionGuard>
      <main className="min-h-screen bg-[#FAF6F1] pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link href="/" className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0">
            ← Back to search
          </Link>
          <h1 className="text-2xl font-bold text-[#1A3A2A] mb-6">Your Favorites</h1>
          <FavouritesGrid />
        </div>
      </main>
    </SubscriptionGuard>
  );
}
```

- [ ] **Step 2: Update app/my-chefs/page.tsx**

Wrap the entire return with `<SubscriptionGuard requiredPlan="chef">`. Add import at top.

- [ ] **Step 3: Update app/chef-results/page.tsx**

Wrap with `<SubscriptionGuard requiredPlan="chef">`.

- [ ] **Step 4: Update app/my-pantry/page.tsx**

Wrap with `<SubscriptionGuard>`.

- [ ] **Step 5: Update app/my-shopping-list/page.tsx**

Wrap with `<SubscriptionGuard>`.

- [ ] **Step 6: Commit**

```bash
git add app/favourites/page.tsx app/my-chefs/page.tsx app/chef-results/page.tsx app/my-pantry/page.tsx app/my-shopping-list/page.tsx
git commit -m "feat: add subscription guards to all protected pages"
```

---

## Task 17: Nav Changes — Sign In/Up Buttons + UserButton

**Files:**
- Modify: `components/ClientNav.tsx`

- [ ] **Step 1: Add auth UI to the nav**

When logged out: show "Sign In" and "Sign Up" buttons in the top-right corner.
When logged in: show Clerk's `<UserButton>` component (avatar with dropdown).

Add imports at the top of `components/ClientNav.tsx`:

```typescript
import { useUser, UserButton, SignInButton, SignUpButton } from "@clerk/nextjs";
```

Inside the `ClientNav` component, add:

```typescript
const { user, isLoaded: clerkLoaded } = useUser();
```

Add the auth buttons in the top-right area. After the toggle button (before the icon rail), add a fixed top-right element:

```typescript
{/* Auth buttons — top right */}
{clerkLoaded && (
  <div className="fixed top-3 right-4 z-[100] flex items-center gap-2">
    {user ? (
      <UserButton
        afterSignOutUrl="/"
        appearance={{
          elements: {
            avatarBox: "w-8 h-8",
          },
        }}
      />
    ) : (
      <>
        <a
          href="/sign-in"
          className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5"
        >
          Sign in
        </a>
        <a
          href="/sign-up"
          className="text-sm font-medium text-white bg-[#1A3A2A] hover:bg-[#2a5a3a] transition-colors px-4 py-1.5 rounded-lg"
        >
          Sign up
        </a>
      </>
    )}
  </div>
)}
```

- [ ] **Step 2: Add Settings link to the collapsed icon rail**

In the icon rail section (the `{hydrated && isDesktop && !sidebarOpen && (` block), add a Settings icon button before the last item:

```typescript
<button
  type="button"
  onClick={() => router.push("/settings")}
  title="Settings"
  className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
>
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2" />
    <path d="M13.5 8a5.5 5.5 0 00-.4-1.3l1.2-1.2-.7-.7-1.2 1.2a5.5 5.5 0 00-1.3-.7V3.5h-1v1.8a5.5 5.5 0 00-1.3.4L7.6 4.5l-.7.7 1.2 1.2A5.5 5.5 0 007.4 8H5.5v1h1.8c.1.5.2.9.4 1.3L6.5 11.5l.7.7 1.2-1.2c.4.2.8.3 1.3.4v1.8h1v-1.8c.5-.1.9-.2 1.3-.4l1.2 1.2.7-.7-1.2-1.2c.2-.4.3-.8.4-1.3h1.8V8z" />
  </svg>
</button>
```

- [ ] **Step 3: Commit**

```bash
git add components/ClientNav.tsx
git commit -m "feat: add auth buttons and settings link to navigation"
```

---

## Task 18: Sidebar — Settings Link + Feature Gating

**Files:**
- Modify: `components/Sidebar.tsx`

- [ ] **Step 1: Add Settings nav item and gate Chef-only links**

In `components/Sidebar.tsx`, add a Settings link to the nav items. Also, conditionally hide "My Chefs" for Basic plan users.

Add import: `import { useUser } from "@clerk/nextjs";` and `import { useQuery } from "convex/react";` and `import { api } from "@/convex/_generated/api";`

Inside the component, add:

```typescript
const { user } = useUser();
const dbUser = useQuery(api.users.getByClerkId, user ? { clerkId: user.id } : "skip");
const isChefPlan = dbUser?.plan === "chef";
```

Update the nav items to conditionally include My Chefs and add Settings:

```typescript
const navItems = [
  ...(isChefPlan ? [{ label: "My Chefs", href: "/my-chefs", icon: "chef" }] : []),
  { label: "Favorites", href: "/favourites", icon: "heart" },
  { label: "My Pantry", href: "/my-pantry", icon: "pantry" },
  { label: "My Shopping List", href: "/my-shopping-list", icon: "cart" },
  { label: "Settings", href: "/settings", icon: "settings" },
];
```

- [ ] **Step 2: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "feat: add Settings link and Chef-plan gating to sidebar"
```

---

## Task 19: Homepage — Disabled State for Unauthenticated Users

**Files:**
- Modify: `components/HomePage.tsx`
- Modify: `components/IngredientInput.tsx`

- [ ] **Step 1: Disable interactions for logged-out users**

In `components/HomePage.tsx`, add a check for authenticated state. If not signed in, overlay the input section with a "Sign Up to Start" CTA and disable the form.

Add near the top of the component:

```typescript
const isSignedIn = !!user;
```

Wrap the "Find Recipes" button to change its behavior when not signed in:

```typescript
// If not signed in, the submit button becomes a sign-up CTA
{!isSignedIn ? (
  <a
    href="/sign-up"
    className="w-full block text-center bg-[#D4622A] text-white py-4 rounded-2xl font-bold text-base hover:bg-[#BF5525] transition-colors"
  >
    Sign Up to Start
  </a>
) : (
  <button
    type="submit"
    disabled={/* existing disabled logic */}
    className="w-full bg-[#D4622A] text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#BF5525] transition-colors"
  >
    Find Recipes
  </button>
)}
```

- [ ] **Step 2: Gate photo button for Basic users**

In `components/IngredientInput.tsx`, add a `showPhotoButton` prop:

```typescript
type Props = {
  // ... existing props
  showPhotoButton?: boolean; // default true for Chef plan, false for Basic
};
```

Wrap the photo button `<div>` with `{showPhotoButton !== false && (... existing photo button ...)}`.

In `components/HomePage.tsx`, pass the prop:

```typescript
<IngredientInput
  // ... existing props
  showPhotoButton={isChefPlan}
/>
```

- [ ] **Step 3: Commit**

```bash
git add components/HomePage.tsx components/IngredientInput.tsx
git commit -m "feat: disable homepage for unauthenticated users, gate photo button for Basic plan"
```

---

## Task 20: Settings Page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Create the settings page**

Displays profile info (first name, last name, email), card on file, subscription status, and cancel button.

```typescript
// app/settings/page.tsx
"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <SubscriptionGuard>
      <SettingsContent />
    </SubscriptionGuard>
  );
}

function SettingsContent() {
  const { user } = useUser();
  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );
  const updateProfile = useMutation(api.users.updateProfile);
  const createPortal = useAction(api.stripe.createPortalSession);
  const cancelSub = useAction(api.stripe.cancelSubscription);

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!dbUser) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </main>
    );
  }

  const displayFirstName = firstName ?? dbUser.firstName ?? "";
  const displayLastName = lastName ?? dbUser.lastName ?? "";

  async function handleSaveProfile() {
    setSaving(true);
    await updateProfile({
      firstName: displayFirstName,
      lastName: displayLastName,
    });
    setSaving(false);
  }

  async function handleManagePayment() {
    if (!dbUser?.stripeCustomerId) return;
    const result = await createPortal({
      stripeCustomerId: dbUser.stripeCustomerId,
    });
    if (result.url) {
      window.location.href = result.url;
    }
  }

  async function handleCancelSubscription() {
    if (!dbUser?.stripeSubscriptionId) return;
    setCancelling(true);
    await cancelSub({ stripeSubscriptionId: dbUser.stripeSubscriptionId });
    setCancelling(false);
    setShowCancel(false);
  }

  const statusLabel =
    dbUser.subscriptionStatus === "trialing"
      ? `Trial (ends ${new Date(dbUser.trialEndsAt!).toLocaleDateString()})`
      : dbUser.subscriptionStatus === "active"
        ? "Active"
        : dbUser.subscriptionStatus === "cancelled"
          ? "Cancelled"
          : dbUser.subscriptionStatus;

  const nextBillingDate = dbUser.currentPeriodEnd
    ? new Date(dbUser.currentPeriodEnd).toLocaleDateString()
    : null;

  const planLabel = dbUser.plan === "chef" ? "Chef" : "Basic";
  const planPrice = dbUser.plan === "chef" ? "$3" : "$2";

  // Cancel confirmation screen
  if (showCancel) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] pb-24">
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-[#1A3A2A] mb-4">
              Are you sure you want to cancel?
            </h2>
            <p className="text-gray-500 mb-2">
              Your access ends on{" "}
              <strong>{nextBillingDate ?? "your billing period end"}</strong>.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              Your recipes, pantry, and favourites will be saved.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium hover:bg-[#2a5a3a] transition-colors"
              >
                Keep my subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
        >
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-8">Settings</h1>

        {/* Profile section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                type="text"
                value={displayFirstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                type="text"
                value={displayLastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <p className="text-sm text-gray-500 px-1">
                {dbUser.email}
              </p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-[#1A3A2A] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>

        {/* Payment section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Payment
          </h2>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Card on file</p>
            <button
              onClick={handleManagePayment}
              className="text-sm text-[#D4622A] hover:underline"
            >
              Update card
            </button>
          </div>
        </section>

        {/* Subscription section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Subscription
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Plan</p>
              <p className="text-sm font-medium text-gray-900">{planLabel}</p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Status</p>
              <p className="text-sm font-medium text-gray-900">{statusLabel}</p>
            </div>

            {nextBillingDate && dbUser.subscriptionStatus !== "cancelled" && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">Next charge</p>
                <p className="text-sm text-gray-900">
                  {planPrice} on {nextBillingDate}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowCancel(true)}
                className="text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                Cancel subscription
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings/page.tsx
git commit -m "feat: add settings page with profile, payment, and subscription management"
```

---

## Task 21: User Sync — Create User on First Sign-In

**Files:**
- Modify: `components/ConvexClientProvider.tsx`

- [ ] **Step 1: Add user sync effect**

After Clerk authentication, we need to create/update the user record in Convex. Add a `useEffect` in the provider that calls `getOrCreateUser` when the Clerk user is available.

```typescript
// components/ConvexClientProvider.tsx
"use client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;

    getOrCreateUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    }).catch(console.error);
  }, [isLoaded, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/ConvexClientProvider.tsx
git commit -m "feat: sync Clerk user to Convex on sign-in"
```

---

## Task 22: Dead Code Cleanup

**Files:**
- Delete: `lib/session.ts`
- Delete: `components/BottomNav.tsx`
- Delete: `components/Navbar.tsx`

- [ ] **Step 1: Delete unused files**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table
rm lib/session.ts components/BottomNav.tsx components/Navbar.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "getSessionId\|from.*lib/session\|BottomNav\|from.*Navbar" --include="*.ts" --include="*.tsx" app/ components/ lib/ convex/`
Expected: No matches (all imports were already updated in Task 14).

If any matches remain, update those files to remove the stale imports.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead code — session.ts, BottomNav, Navbar"
```

---

## Task 23: Environment Variables Setup

**Files:** None (dashboard/config changes only)

- [ ] **Step 1: Document required environment variables**

Add these to `.env.local` for local development:

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Stripe price IDs (create in Stripe dashboard first)
NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_CHEF_EARLY_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_CHEF_STANDARD_PRICE_ID=price_...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Set in Convex environment:

```bash
npx convex env set STRIPE_SECRET_KEY sk_test_...
npx convex env set STRIPE_WEBHOOK_SECRET whsec_...
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-instance.clerk.accounts.dev
npx convex env set NEXT_PUBLIC_APP_URL http://localhost:3000
```

Set the same Stripe price IDs in Convex environment since the action needs them:

```bash
npx convex env set STRIPE_BASIC_PRICE_ID price_...
npx convex env set STRIPE_CHEF_EARLY_PRICE_ID price_...
npx convex env set STRIPE_CHEF_STANDARD_PRICE_ID price_...
```

- [ ] **Step 2: Add .env.local entries to .gitignore check**

Run: `grep ".env.local" .gitignore`
Expected: `.env.local` is already listed (Next.js default). If not, add it.

- [ ] **Step 3: Commit .env.example if helpful**

Create `.env.example` with placeholder values (no secrets) for documentation:

```bash
git add .env.example
git commit -m "docs: add .env.example with required environment variables"
```

---

## Task 24: Verify Build and Test

- [ ] **Step 1: Run TypeScript compiler**

Run: `cd C:/Users/abhiv/claudecode_projects/fridge_to_table && npx tsc --noEmit`
Expected: No type errors.

Fix any type errors before proceeding.

- [ ] **Step 2: Run existing tests**

Run: `npm test`

Some tests will fail because they mock `getSessionId` or reference `sessionId`. Update test files:

- `tests/unit/session.test.ts` — Delete this file (session system removed)
- Tests that mock `lib/session` — Update mocks to use `@clerk/nextjs` `useUser` instead
- Tests that pass `sessionId` to Convex functions — Change to `userId`

- [ ] **Step 3: Run the dev server and verify manually**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:
1. Homepage loads with disabled inputs and "Sign Up to Start" button
2. Sign In / Sign Up buttons appear in nav
3. Clicking "Sign Up to Start" goes to `/sign-up`
4. Sign up flow works (Google + email/password)
5. After sign-up, redirected to `/pricing`
6. Pricing page shows two tiers
7. Checkout redirects to Stripe (use test mode)
8. After checkout, app is fully accessible
9. Chef's Table tab hidden for Basic plan users
10. Photo button hidden for Basic plan users
11. Settings page shows profile and subscription info
12. Cancel flow works with confirmation

- [ ] **Step 4: Commit any test fixes**

```bash
git add -A
git commit -m "fix: update tests for auth migration — replace sessionId mocks with Clerk userId"
```
