# Clerk Auth-Only Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Clerk-based authentication (Google OAuth + email/password) to Fridge to Table. All user-owned Convex data keyed by Clerk user ID. No Stripe, no subscription, no `/settings` page. UserButton in top-right nav opens Clerk's Manage Account modal.

**Architecture:** Clerk handles sign-in/sign-up UI + JWT session management. `ConvexProviderWithClerk` passes Clerk's JWT to Convex. A `users` table in Convex maps Clerk user IDs to app-specific profile data (email, name). All user-owned Convex tables (`recipes`, `favourites`, `customChefs`, `pantryItems`, `shoppingListItems`) rename `sessionId` → `userId` (stores the Clerk user ID string). Middleware protects app routes; `AuthGuard` handles the client-side loading-and-redirect UX. `lib/session.ts` (anonymous session id generator) is removed.

**Tech Stack:** Next.js 16 (App Router), Clerk v7 (`@clerk/nextjs`), Convex 1.32, React 19, TypeScript, Vitest + Testing Library.

---

## File Structure

### Create

| File | Responsibility |
|---|---|
| `middleware.ts` | Clerk middleware protecting non-public routes |
| `convex/auth.config.ts` | Convex JWT validation against Clerk issuer |
| `convex/users.ts` | `getByClerkId` query + `getOrCreateUser` mutation |
| `app/sign-in/[[...sign-in]]/page.tsx` | Sign-in route (renders `AuthPage`) |
| `app/sign-up/[[...sign-up]]/page.tsx` | Sign-up route (renders `AuthPage`) |
| `components/AuthPage.tsx` | Shared wrapper around Clerk `<SignIn>` / `<SignUp>` with logo + styling |
| `components/AuthGuard.tsx` | Client-side auth gate for protected pages (loading UX + redirect to sign-in) |
| `components/ConvexClientProvider.tsx` | Wraps app with `<ClerkProvider>` + `<ConvexProviderWithClerk>` + auto-syncs user on sign-in |

### Modify

| File | Change |
|---|---|
| `package.json` | Add `@clerk/nextjs@^7.0.0` |
| `app/layout.tsx` | Wrap children in `<ConvexClientProvider>` |
| `convex/schema.ts` | Add `users` table; rename `sessionId` → `userId` across all user-owned tables; rename indexes `by_session*` → `by_user*` |
| `convex/customChefs.ts` | `sessionId` arg → `userId`; update index call |
| `convex/favourites.ts` | Same |
| `convex/pantry.ts` | Same |
| `convex/recipes.ts` | Same |
| `convex/shoppingList.ts` | Same |
| `components/HomePage.tsx` | Replace `getSessionId()` with `useUser().user.id`; pass `userId` instead of `sessionId` |
| `components/PantryPage.tsx` | Same |
| `components/ShoppingListPage.tsx` | Same |
| `components/FavouriteButton.tsx` | Same |
| `components/FavouritesGrid.tsx` | Same |
| `components/RecipeIngredientsList.tsx` | Same |
| `components/RecipeShoppingCard.tsx` | Same |
| `app/my-chefs/page.tsx` | Same |
| `components/ClientNav.tsx` | Add UserButton (signed-in) + sign-in/sign-up links (signed-out) |
| `app/api/generate-recipes/route.ts` | Auth via `auth()` from `@clerk/nextjs/server`; use `userId` from auth, not request body |
| `app/favourites/page.tsx` | Wrap content in `<AuthGuard>` |
| `app/my-chefs/page.tsx` | Wrap content in `<AuthGuard>` |
| `app/my-pantry/page.tsx` | Wrap content in `<AuthGuard>` |
| `app/my-shopping-list/page.tsx` | Wrap content in `<AuthGuard>` |
| `app/chef-results/page.tsx` | Wrap content in `<AuthGuard>` |
| `tests/unit/PantryPage.test.tsx` | Mock Clerk `useUser`; swap `sessionId` → `userId` |
| `tests/unit/ShoppingListPage.test.tsx` | Same |
| `tests/unit/RecipeIngredientsList.test.tsx` | Add Clerk mock |
| `tests/unit/RecipeShoppingCard.test.tsx` | Add Clerk mock; swap `sessionId` → `userId` |
| `tests/unit/ClientNav.test.tsx` | Add Clerk mock |
| `tests/unit/Sidebar.test.tsx` | No change (already doesn't use user) |
| `tests/integration/customChefs.test.ts` | Swap `sessionId` → `userId` in test data |
| `tests/integration/favourites.test.ts` | Same |
| `tests/integration/recipes.test.ts` | Same |
| `tests/integration/photos.test.ts` | No user fields involved — likely no change |
| `.env.example` | Add Clerk env vars |

### Delete

| File | Reason |
|---|---|
| `lib/session.ts` | Anonymous session id no longer needed; Clerk user id replaces it |
| `tests/unit/session.test.ts` | Source file deleted |

---

## Task 1: Install Clerk and set up auth scaffolding

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Clerk**

```bash
npm install @clerk/nextjs@^7.0.0
```

- [ ] **Step 2: Verify install**

```bash
grep clerk package.json
```
Expected: a line `"@clerk/nextjs": "^7..."` in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(auth): install @clerk/nextjs"
```

---

## Task 2: Add Convex auth config

**Files:**
- Create: `convex/auth.config.ts`

- [ ] **Step 1: Create the auth config**

```ts
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add convex/auth.config.ts
git commit -m "feat(auth): add Convex JWT validation against Clerk"
```

---

## Task 3: Add Clerk middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create the middleware**

```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add Clerk middleware for protected routes"
```

---

## Task 4: Schema — users table + sessionId → userId rename

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Rewrite the schema**

Replace `convex/schema.ts` entirely with:

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// All user-owned tables are keyed by the Clerk user ID string (stored as `userId`).
export default defineSchema({
  // Users — mirrors Clerk identity for attaching app-specific data later.
  // Created on first sign-in via getOrCreateUser mutation.
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  // Each row stores one "search" — a set of 3 generated recipes for a user.
  recipes: defineTable({
    userId: v.string(),                // Clerk user ID
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

  // Tracks which recipes a user has saved as favourites.
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

- [ ] **Step 2: Commit** (Convex functions won't compile yet — next task fixes them)

```bash
git add convex/schema.ts
git commit -m "feat(schema): add users table, rename sessionId → userId"
```

---

## Task 5: Convex users module

**Files:**
- Create: `convex/users.ts`
- Test: `tests/integration/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/integration/users.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("users module", () => {
  test("getByClerkId returns null for unknown user", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.users.getByClerkId, { clerkId: "user_none" });
    expect(result).toBeNull();
  });

  test("getOrCreateUser inserts a new user on first call", async () => {
    const t = convexTest(schema);
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    });
    const user = await t.query(api.users.getByClerkId, { clerkId: "user_test" });
    expect(user?.clerkId).toBe("user_test");
    expect(user?.email).toBe("test@example.com");
    expect(user?.firstName).toBe("Test");
    expect(user?.lastName).toBe("User");
  });

  test("getOrCreateUser is idempotent — does not create duplicates", async () => {
    const t = convexTest(schema);
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "test@example.com",
    });
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "test@example.com",
    });
    const allUsers = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(allUsers).toHaveLength(1);
  });

  test("getOrCreateUser updates email/name fields when user already exists", async () => {
    const t = convexTest(schema);
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "old@example.com",
      firstName: "Old",
    });
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "new@example.com",
      firstName: "New",
      lastName: "Person",
    });
    const user = await t.query(api.users.getByClerkId, { clerkId: "user_test" });
    expect(user?.email).toBe("new@example.com");
    expect(user?.firstName).toBe("New");
    expect(user?.lastName).toBe("Person");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run --project integration tests/integration/users.test.ts
```
Expected: FAIL (module `api.users` doesn't exist yet).

- [ ] **Step 3: Create the users module**

Create `convex/users.ts`:

```ts
// convex/users.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get user by Clerk ID — used by components to check if the user record exists.
export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

// Get-or-create on sign-in. Idempotent: if user exists, refreshes their
// profile fields; otherwise inserts a new row.
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run --project integration tests/integration/users.test.ts
```
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add convex/users.ts tests/integration/users.test.ts
git commit -m "feat(users): add getByClerkId query + getOrCreateUser mutation"
```

---

## Task 6: Rename sessionId → userId in Convex functions

**Files:**
- Modify: `convex/customChefs.ts`, `convex/favourites.ts`, `convex/pantry.ts`, `convex/recipes.ts`, `convex/shoppingList.ts`

These are mechanical renames. Pattern for each file:
- Rename all `sessionId: v.string()` args to `userId: v.string()`
- Rename all `args.sessionId` uses to `args.userId`
- Rename all `.withIndex("by_session", ...)` calls to `.withIndex("by_user", ...)`
- Rename all `.withIndex("by_session_and_name", ...)` to `.withIndex("by_user_and_name", ...)`
- Rename all `sessionId` properties in `ctx.db.insert(...)` to `userId`

- [ ] **Step 1: Update `convex/customChefs.ts`** — replace every `sessionId` identifier with `userId`, every `by_session` index name with `by_user`

Read the file first, then do a global replace. The logic is otherwise unchanged.

- [ ] **Step 2: Update `convex/favourites.ts`** — same rename pattern

- [ ] **Step 3: Update `convex/pantry.ts`** — same rename pattern (note: this file has `by_session_and_name` → `by_user_and_name`)

- [ ] **Step 4: Update `convex/recipes.ts`** — same rename pattern

- [ ] **Step 5: Update `convex/shoppingList.ts`** — same rename pattern (also has `by_session_and_name` → `by_user_and_name`)

- [ ] **Step 6: Run typechecker**

```bash
npx tsc --noEmit
```
Expected: no errors from Convex files (frontend may still error — fixed in later tasks).

- [ ] **Step 7: Commit**

```bash
git add convex/customChefs.ts convex/favourites.ts convex/pantry.ts convex/recipes.ts convex/shoppingList.ts
git commit -m "refactor(convex): sessionId → userId across all user-owned functions"
```

---

## Task 7: Update integration tests — sessionId → userId

**Files:**
- Modify: `tests/integration/customChefs.test.ts`
- Modify: `tests/integration/favourites.test.ts`
- Modify: `tests/integration/recipes.test.ts`

- [ ] **Step 1: Update each integration test** — rename `sessionId` to `userId` in:
  - Direct `ctx.db.insert` calls seeding test data
  - Calls to `t.query(...)` / `t.mutation(...)` passing `{ sessionId: ... }` — rename to `{ userId: ... }`
  - Variable names if they're called `sessionId` locally

- [ ] **Step 2: Run integration tests**

```bash
npx vitest run --project integration
```
Expected: all integration tests pass (users.test.ts passes + existing tests pass after rename).

- [ ] **Step 3: Commit**

```bash
git add tests/integration/customChefs.test.ts tests/integration/favourites.test.ts tests/integration/recipes.test.ts
git commit -m "test(integration): sessionId → userId in test data"
```

---

## Task 8: Update API route — auth required, userId from Clerk

**Files:**
- Modify: `app/api/generate-recipes/route.ts`

- [ ] **Step 1: Replace the route handler**

```ts
import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { ingredients, filters } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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

    const recipeSetId = await convex.mutation(
      api.recipes.saveRecipeSet,
      { userId, ingredients, filters, results: recipes }
    );

    return Response.json({ recipeSetId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-recipes] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/generate-recipes/route.ts
git commit -m "feat(api): require Clerk auth on generate-recipes, userId from auth"
```

---

## Task 9: ConvexClientProvider with Clerk

**Files:**
- Create: `components/ConvexClientProvider.tsx`

- [ ] **Step 1: Create the provider**

```tsx
// components/ConvexClientProvider.tsx
"use client";

import { ReactNode, useEffect } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Auto-syncs the signed-in Clerk user into our Convex `users` table once
// Clerk is loaded and Convex is authenticated.
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

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <UserSync />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Install convex/react-clerk binding** (should come with convex package, but verify)

```bash
grep "convex/react-clerk" node_modules/convex/package.json
```
Expected: entry exists (shipped with `convex` package).

- [ ] **Step 3: Commit**

```bash
git add components/ConvexClientProvider.tsx
git commit -m "feat(auth): add ConvexClientProvider wiring Clerk + Convex + UserSync"
```

---

## Task 10: Wrap app layout with ConvexClientProvider

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current layout**

```bash
cat app/layout.tsx
```

- [ ] **Step 2: Wrap `{children}` with `<ConvexClientProvider>`**

Replace the body's children wrapping. Specifically, find the element that renders `{children}` (likely inside `<body>`) and wrap with `<ConvexClientProvider>{children}</ConvexClientProvider>`. Import:

```tsx
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
```

The wrapping pattern:

```tsx
<body>
  <ConvexClientProvider>
    {/* existing children tree */}
  </ConvexClientProvider>
</body>
```

Leave all other layout (fonts, metadata, classnames) unchanged.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(auth): wrap app with ConvexClientProvider"
```

---

## Task 11: Shared AuthPage component

**Files:**
- Create: `components/AuthPage.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/AuthPage.tsx
"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link
            href="/"
            className="text-2xl font-bold text-[#1A3A2A]"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            fridge to table
          </Link>
        </div>

        {initialMode === "sign-in" ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white rounded-2xl shadow-sm border border-gray-100 w-full",
                headerTitle: "text-lg font-semibold text-gray-800",
                formButtonPrimary: "bg-[#1A3A2A] hover:bg-[#2a5a3a] text-white rounded-xl",
                formFieldInput: "rounded-xl border-gray-300 focus:border-[#D4622A]",
                footerActionLink: "text-[#D4622A] hover:text-[#BF5525]",
              },
            }}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white rounded-2xl shadow-sm border border-gray-100 w-full",
                headerTitle: "text-lg font-semibold text-gray-800",
                formButtonPrimary: "bg-[#1A3A2A] hover:bg-[#2a5a3a] text-white rounded-xl",
                formFieldInput: "rounded-xl border-gray-300 focus:border-[#D4622A]",
                footerActionLink: "text-[#D4622A] hover:text-[#BF5525]",
              },
            }}
          />
        )}

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

- [ ] **Step 2: Commit**

```bash
git add components/AuthPage.tsx
git commit -m "feat(auth): shared AuthPage component (sign-in/sign-up)"
```

---

## Task 12: Sign-in and sign-up routes

**Files:**
- Create: `app/sign-in/[[...sign-in]]/page.tsx`
- Create: `app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Create sign-in page**

```tsx
// app/sign-in/[[...sign-in]]/page.tsx
import { AuthPage } from "@/components/AuthPage";

export default function Page() {
  return <AuthPage initialMode="sign-in" />;
}
```

- [ ] **Step 2: Create sign-up page**

```tsx
// app/sign-up/[[...sign-up]]/page.tsx
import { AuthPage } from "@/components/AuthPage";

export default function Page() {
  return <AuthPage initialMode="sign-up" />;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/sign-in app/sign-up
git commit -m "feat(auth): add /sign-in and /sign-up routes"
```

---

## Task 13: AuthGuard component

**Files:**
- Create: `components/AuthGuard.tsx`

- [ ] **Step 1: Create the guard**

```tsx
// components/AuthGuard.tsx
"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Commit**

```bash
git add components/AuthGuard.tsx
git commit -m "feat(auth): AuthGuard for client-side protected pages"
```

---

## Task 14: Wrap protected pages with AuthGuard

**Files:**
- Modify: `app/favourites/page.tsx`, `app/my-chefs/page.tsx`, `app/my-pantry/page.tsx`, `app/my-shopping-list/page.tsx`, `app/chef-results/page.tsx`

- [ ] **Step 1: For each protected page, wrap its top-level return in `<AuthGuard>`**

Each page currently exports a default function that returns JSX. Add import:

```tsx
import { AuthGuard } from "@/components/AuthGuard";
```

And wrap the root:

```tsx
export default function Page() {
  return (
    <AuthGuard>
      {/* ...existing JSX... */}
    </AuthGuard>
  );
}
```

Do this for all 5 files.

- [ ] **Step 2: Commit**

```bash
git add app/favourites/page.tsx app/my-chefs/page.tsx app/my-pantry/page.tsx app/my-shopping-list/page.tsx app/chef-results/page.tsx
git commit -m "feat(auth): wrap protected pages with AuthGuard"
```

---

## Task 15: Update components — getSessionId → useUser

**Files:**
- Modify: `components/HomePage.tsx`, `components/PantryPage.tsx`, `components/ShoppingListPage.tsx`, `components/FavouriteButton.tsx`, `components/FavouritesGrid.tsx`, `components/RecipeIngredientsList.tsx`, `components/RecipeShoppingCard.tsx`, `app/my-chefs/page.tsx`

Each file currently imports `getSessionId` from `@/lib/session` and calls it to get a `sessionId`. Replace with:

```tsx
import { useUser } from "@clerk/nextjs";
// ...
const { user } = useUser();
const userId = user?.id ?? "";
```

And rename any local `sessionId` variable to `userId` where it flows into Convex calls. Use `"skip"` pattern for queries when `userId` is empty:

```tsx
const data = useQuery(
  api.favourites.getFavourites,
  userId ? { userId } : "skip"
);
```

For API calls like `fetch("/api/generate-recipes", ...)`, remove `sessionId` from the request body (the route now reads it from Clerk auth).

- [ ] **Step 1: Update `components/HomePage.tsx`**

Find `const sessionId = getSessionId();` and replace with useUser pattern. Remove `sessionId` from the `/api/generate-recipes` fetch body. Update `useQuery(api.customChefs.listCustomChefs, sessionId ? { sessionId } : "skip")` to `userId ? { userId } : "skip"`.

- [ ] **Step 2: Update `components/PantryPage.tsx`** — same pattern

- [ ] **Step 3: Update `components/ShoppingListPage.tsx`** — same pattern

- [ ] **Step 4: Update `components/FavouriteButton.tsx`** — same pattern

- [ ] **Step 5: Update `components/FavouritesGrid.tsx`** — same pattern

- [ ] **Step 6: Update `components/RecipeIngredientsList.tsx`** — same pattern

- [ ] **Step 7: Update `components/RecipeShoppingCard.tsx`** — same pattern

- [ ] **Step 8: Update `app/my-chefs/page.tsx`** — same pattern

- [ ] **Step 9: Run typechecker**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/HomePage.tsx components/PantryPage.tsx components/ShoppingListPage.tsx components/FavouriteButton.tsx components/FavouritesGrid.tsx components/RecipeIngredientsList.tsx components/RecipeShoppingCard.tsx app/my-chefs/page.tsx
git commit -m "refactor(components): replace getSessionId with useUser.id"
```

---

## Task 16: Add UserButton + sign-in/sign-up links to nav

**Files:**
- Modify: `components/ClientNav.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat components/ClientNav.tsx
```

- [ ] **Step 2: Add auth UI to the top-right area**

Add these imports at the top:

```tsx
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import Link from "next/link";
```

Find the top-right nav area (typically near the end of the main nav flex container). Add:

```tsx
<SignedOut>
  <Link
    href="/sign-in"
    className="text-sm text-gray-600 hover:text-[#1A3A2A] transition-colors"
  >
    Sign in
  </Link>
  <Link
    href="/sign-up"
    className="text-sm bg-[#1A3A2A] text-white px-4 py-1.5 rounded-full hover:bg-[#2a5a3a] transition-colors"
  >
    Sign up
  </Link>
</SignedOut>
<SignedIn>
  <UserButton
    appearance={{
      elements: {
        avatarBox: "w-8 h-8",
      },
    }}
  />
</SignedIn>
```

The exact placement depends on the existing nav layout — aim for the top-right area alongside any existing right-aligned nav elements.

- [ ] **Step 3: Commit**

```bash
git add components/ClientNav.tsx
git commit -m "feat(nav): add UserButton (signed-in) + sign-in/sign-up links (signed-out)"
```

---

## Task 17: Update component tests — Clerk mocks

**Files:**
- Modify: `tests/unit/PantryPage.test.tsx`, `tests/unit/ShoppingListPage.test.tsx`, `tests/unit/RecipeIngredientsList.test.tsx`, `tests/unit/RecipeShoppingCard.test.tsx`, `tests/unit/ClientNav.test.tsx`

Any component test that exercises a signed-in user needs a Clerk mock:

```tsx
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
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
```

- [ ] **Step 1: Update `tests/unit/PantryPage.test.tsx`** — add Clerk mock; rename any `sessionId` in test data to `userId`

- [ ] **Step 2: Update `tests/unit/ShoppingListPage.test.tsx`** — same

- [ ] **Step 3: Update `tests/unit/RecipeIngredientsList.test.tsx`** — add Clerk mock

- [ ] **Step 4: Update `tests/unit/RecipeShoppingCard.test.tsx`** — add Clerk mock; rename `sessionId` → `userId`

- [ ] **Step 5: Update `tests/unit/ClientNav.test.tsx`** — add Clerk mock (including SignedIn/SignedOut)

- [ ] **Step 6: Run unit tests**

```bash
npx vitest run --project unit
```
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add tests/unit
git commit -m "test(unit): add Clerk mocks, swap sessionId → userId"
```

---

## Task 18: Remove lib/session.ts

**Files:**
- Delete: `lib/session.ts`
- Delete: `tests/unit/session.test.ts`

- [ ] **Step 1: Verify nothing still imports it**

```bash
grep -rn "from \"@/lib/session\"\|from \"./lib/session\"" app components lib 2>/dev/null
```
Expected: empty output.

- [ ] **Step 2: Delete the files**

```bash
rm lib/session.ts tests/unit/session.test.ts
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git rm lib/session.ts tests/unit/session.test.ts
git commit -m "chore: remove unused anonymous session module"
```

---

## Task 19: Update .env.example

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Read current file**

```bash
cat .env.example
```

- [ ] **Step 2: Rewrite with all needed env vars**

```
# Convex
NEXT_PUBLIC_CONVEX_URL=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Anthropic (required for /api/generate-recipes)
ANTHROPIC_API_KEY=sk-ant-api03-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Convex environment variables (set via `npx convex env set`):
# STRIPE_SECRET_KEY=sk_test_...    # (deferred — no Stripe in this branch)
# CLERK_JWT_ISSUER_DOMAIN=https://your-clerk-instance.clerk.accounts.dev
# YOUTUBE_API_KEY=...
# ANTHROPIC_API_KEY=sk-ant-api03-...
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore(env): document Clerk and Anthropic env vars"
```

---

## Task 20: Final verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no output (exit 0).

- [ ] **Step 2: Full test suite**

```bash
npm test
```
Expected: all tests pass. Count should be roughly the previous total (the `session.test.ts` suite is gone; the new `users.test.ts` replaces it).

- [ ] **Step 3: Dev server sanity (assuming Convex dev running)**

```bash
npm run dev
```
Then:
- `curl -s -o /dev/null -w "home: %{http_code}\n" http://localhost:3000/` → 200
- `curl -s -o /dev/null -w "sign-in: %{http_code}\n" http://localhost:3000/sign-in` → 200
- `curl -s -o /dev/null -w "sign-up: %{http_code}\n" http://localhost:3000/sign-up` → 200

- [ ] **Step 4: Dead-code grep**

```bash
grep -rn "getSessionId\|sessionId:" --include="*.ts" --include="*.tsx" app components convex lib 2>/dev/null | grep -v "_generated"
```
Expected: empty. If anything remains, chase it down.

---

## Self-Review

**1. Spec coverage:**
- Clerk install + middleware + auth config → Tasks 1, 2, 3 ✓
- Sign-in / sign-up routes + AuthPage → Tasks 11, 12 ✓
- UserButton in nav → Task 16 ✓
- Users table in Convex + getOrCreateUser → Tasks 4, 5 ✓
- `sessionId → userId` across backend → Tasks 4, 6, 7 ✓
- `sessionId → userId` across frontend → Task 15 ✓
- API route requires auth → Task 8 ✓
- ClerkProvider + Convex integration → Tasks 9, 10 ✓
- AuthGuard on protected pages → Tasks 13, 14 ✓
- Tests updated with Clerk mocks → Task 17 ✓
- Remove anonymous session code → Task 18 ✓
- Env docs → Task 19 ✓
- No Stripe, no `/settings`, no PricingCards → implicit (we don't create them) ✓

**2. Placeholder scan:** No TBDs, all code shown in full.

**3. Type consistency:**
- `userId: v.string()` consistent across `users.ts`, `recipes.ts`, `favourites.ts`, `customChefs.ts`, `pantry.ts`, `shoppingList.ts` ✓
- Index names consistent: `by_user`, `by_user_and_recipe`, `by_user_and_name` ✓
- `getByClerkId` + `getOrCreateUser` signatures consistent between plan and usage in `UserSync` ✓
- `useUser()` pattern consistent across all frontend touchpoints ✓

---

## Execution

Executing inline via `superpowers:executing-plans` — 20 tasks batched in ~4-5 checkpoints. TDD where a test makes sense (users module, integration test updates); mechanical refactors elsewhere.
