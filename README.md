# Fridge to Table

A recipe suggestion web app that generates personalised recipes from the ingredients you already have. Powered by Claude AI.

**Live:** https://fridge-to-table-mu.vercel.app

---

## Overview

Fridge to Table lets users input their available ingredients — either by typing a comma-separated list or uploading a fridge photo — and instantly receive three tailored recipe suggestions. Users can filter by diet (vegetarian, vegan, non-vegetarian), cuisine style, cooking time, and difficulty. Recipes include step-by-step instructions, a pantry-aware ingredients list, and an interactive shopping list card for anything missing.

The app features a **Chef's Table** mode where users can discover up to 3 most relevant YouTube recipe videos per chef from popular cooking creators (8 featured chefs + up to 6 custom YouTube channels). A collapsible **sidebar** provides quick access to search history, favourites, pantry, shopping list, and new searches. Favourites can be saved and revisited across devices.

Users can manage a persistent **My Pantry** of staple ingredients they always have on hand, and a **My Shopping List** of items to buy. Recipe pages are pantry-aware — ingredients already in the pantry are highlighted, and the shopping list card automatically hides pantry items.

Authentication is provided by **Clerk** (Google OAuth + email/password). All user-owned data (favourites, pantry, shopping list, custom chefs, recipe history) is scoped to the authenticated Clerk user ID — users keep their data across browsers and devices. The home page and Chef's Table are browsable signed-out; writes and personal lists require sign-in.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                Next.js 16 (Vercel)                   │
│  App Router · TypeScript · Tailwind CSS              │
│  Middleware-level Clerk auth · API route (streaming) │
└────┬───────────────────┬──────────────────┬──────────┘
     │  Clerk            │  Convex React    │  Anthropic SDK
     │  (SignIn/SignUp,  │  + Clerk JWT     │
     │  UserButton)      │  via             │
     │                   │  ConvexProvider  │
     ▼                   ▼                  ▼
┌─────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Clerk     │   │ Convex (Backend) │   │ Claude Sonnet    │
│  (Auth,     │   │ Mutations · Qry  │   │ 4.6 (Anthropic)  │
│  Session    │   │ Actions · DB     │   │ Recipe gen via   │
│  JWT)       │   │ JWT-validated    │   │ API route        │
└─────────────┘   │ via issuer       │   │                  │
                  │ domain           │   │                  │
                  └──────────────────┘   └──────────────────┘
```

**Key design decisions:**

- **Hybrid backend architecture.** Recipe generation uses a Next.js API route (`/api/generate-recipes`) that calls Claude Sonnet directly via streaming, then saves results to Convex via `fetchMutation` (forwarding the Clerk JWT). This reduces latency from ~40s (through Convex Actions) to ~28s (direct connection to Anthropic). All other Claude API calls (photo analysis, Chef's Table) remain in Convex Actions. The Convex `generateRecipes` action is kept as a production-identical fallback.
- **Prompt caching via system message.** The recipe generation API route uses a separate `system` parameter for the persona instruction ("You are a creative chef..."), enabling Anthropic's prompt caching — subsequent calls within 5 minutes skip re-processing the system prompt.
- **Convex as the primary backend.** Photo analysis, Chef's Table video search, favourites, pantry, and shopping list all use Convex Actions and Mutations. The Anthropic API key lives in both Convex environment variables (for actions) and Vercel environment variables (for the API route).
- **Clerk + Convex auth.** Clerk handles the UI (Google OAuth, email/password, UserButton). `ConvexProviderWithClerk` forwards Clerk's session JWT to Convex on every query/mutation. Convex validates the JWT against `CLERK_JWT_ISSUER_DOMAIN` and exposes the Clerk user ID via `ctx.auth.getUserIdentity().subject`. All user-owned tables store `userId: string` (the Clerk user ID) — there is intentionally no `users` table (YAGNI — Clerk is the source of truth for identity).
- **Server-derived user identity.** User-owned Convex functions never accept `userId` as a client argument. The helper `requireUserId(ctx)` in `convex/auth.ts` derives identity from the JWT. Delete-by-ID mutations additionally verify ownership before mutating.
- **Two-stage client-side auth readiness.** The `useAuthedUser()` hook combines Clerk's `isLoaded` with Convex's `useConvexAuth().isAuthenticated` — this closes a race where Clerk reports "loaded" before `ConvexProviderWithClerk` has attached the JWT. All `useQuery` calls against authed Convex functions gate on `useAuthedUser().isReady`.
- **Middleware protection + AuthGuard UX.** `middleware.ts` enforces auth at the routing layer (unauth'd visits to protected routes redirect to `/sign-in`). `components/AuthGuard.tsx` provides a loading spinner UX inside the protected page while Clerk hydrates on the client.
- **Server components for data pages.** The results and recipe detail pages are Next.js Server Components using `fetchQuery` — data is fetched before the page renders, eliminating loading spinners.
- **Real-time favourites.** `useQuery` from Convex provides live updates — saving or removing a favourite reflects instantly without a page refresh.
- **Two-tier chef selection.** Chef's Table slots (which chefs appear) are stored in `localStorage`. Per-search toggles (which slotted chefs to include) are transient UI state. This keeps the roster persistent without extra DB writes.
- **Search state persistence.** The active tab is encoded in the URL query parameter (`?tab=chefs-table`) via `router.replace()`, so the server renders the correct tab on first paint — no flash on back-navigation. Ingredients and filters are saved to `sessionStorage` on submit and restored after mount. "New Search" and new tabs/windows start fresh.
- **Server/Client Component split for hydration safety.** The home page (`app/page.tsx`) is a Server Component that reads `searchParams` and passes `initialTab` as a prop to the Client Component (`components/HomePage.tsx`). This ensures the first render is deterministic — no hydration mismatches from client-only state like `sessionStorage` or `useSearchParams`.
- **Conditional entrance animations.** Hero and card animations play only on the first visit per session. Animation state is deferred to `useEffect` (initialized as `false`, enabled after mount) to prevent server/client markup divergence. Return visits (back-nav, New Search) load instantly without animation delays.
- **Gesture intent lock (mobile sidebar).** Swipe-to-dismiss uses a 12px dead zone to disambiguate scroll vs swipe. Once the dominant axis is determined, the gesture locks — vertical scrolling never triggers horizontal panel movement.
- **YouTube channel resolution.** Custom chefs are resolved via YouTube Data API (called from Convex Action) — the client never touches external APIs directly.
- **Pantry-aware recipe pages.** The ingredients list and shopping list card on recipe detail pages query the user's pantry in real-time. Ingredients in the pantry get a green indicator; items already in the pantry are hidden from the shopping list card entirely. Compound ingredients like "salt and pepper" are split and matched individually.
- **Server-side name normalization.** Pantry and shopping list mutations normalize names (lowercase, depluralize, resolve aliases, strip qualifiers like "fresh"/"dried") and auto-classify pantry items into categories — all inside Convex mutations for atomic dedup. Normalization logic is duplicated between `lib/pantryUtils.ts` (client) and `convex/pantry.ts` / `convex/shoppingList.ts` (backend) because Convex cannot import from Next.js `lib/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Auth | Clerk v7 (`@clerk/nextjs`), Convex JWT validation (`convex/react-clerk`) |
| Backend | Convex (Actions, Mutations, Queries) |
| Database | Convex (built-in) |
| AI | Claude Sonnet 4.6 via `@anthropic-ai/sdk` |
| Unit/Integration Tests | Vitest, React Testing Library, `convex-test` |
| E2E Tests | Playwright |
| External APIs | YouTube Data API v3 (channel resolution for custom chefs) |
| Hosting | Vercel (frontend) + Convex (backend) |

---

## Project Structure

```
fridge_to_table/
├── middleware.ts                           # Clerk middleware — protects non-public routes
├── app/
│   ├── layout.tsx                          # Root layout with ConvexClientProvider (Clerk + Convex)
│   ├── page.tsx                            # Server Component — derives initialTab from searchParams
│   ├── api/generate-recipes/route.ts      # Recipe generation API route (Clerk auth + streaming Claude)
│   ├── sign-in/[[...sign-in]]/page.tsx     # Clerk sign-in route
│   ├── sign-up/[[...sign-up]]/page.tsx     # Clerk sign-up route
│   ├── results/[recipeSetId]/page.tsx      # Results page (3 recipe cards) — forwards Clerk JWT
│   ├── recipe/[recipeSetId]/[recipeIndex]/ # Recipe detail page — forwards Clerk JWT
│   ├── chef-results/page.tsx              # Chef's Table results page (AuthGuard)
│   ├── favourites/page.tsx                 # Saved favourites page (AuthGuard)
│   ├── my-chefs/page.tsx                   # Manage chef roster (AuthGuard)
│   ├── my-pantry/page.tsx                  # My Pantry page (AuthGuard)
│   └── my-shopping-list/page.tsx           # My Shopping List page (AuthGuard)
├── components/
│   ├── HomePage.tsx                        # Client Component — home page (ingredients, filters, Chef's Table)
│   ├── ConvexClientProvider.tsx            # ClerkProvider + ConvexProviderWithClerk
│   ├── AuthPage.tsx                        # Shared shell for Clerk <SignIn>/<SignUp>
│   ├── AuthGuard.tsx                       # Client gate: loading spinner + redirect to /sign-in
│   ├── ClientNav.tsx                       # Top nav + collapsed icon rail (desktop); single "Log in" CTA / UserButton
│   ├── Sidebar.tsx                         # Slide-out sidebar (history, favourites, new search)
│   ├── IngredientInput.tsx                 # Text/photo input + diet filter
│   ├── FiltersPanel.tsx                    # Collapsible cuisine/time/difficulty filters
│   ├── ChefGrid.tsx                        # Multi-select grid of chefs for Chef's Table tab
│   ├── ChefVideoCard.tsx                   # Single video thumbnail card (used in chef results grid)
│   ├── VideoModal.tsx                      # Inline YouTube player modal overlay
│   ├── CustomChefCard.tsx                  # Preview card when adding a custom YouTube chef
│   ├── RecipeCard.tsx                      # Recipe summary card (links to detail)
│   ├── FavouriteButton.tsx                 # Heart toggle (save/remove)
│   ├── FavouritesGrid.tsx                  # Grid of saved recipes
│   ├── PantryPage.tsx                      # My Pantry client component (categorized pills, undo toast)
│   ├── ShoppingListPage.tsx                # My Shopping List client component (flat list, fade-out remove)
│   ├── RecipeIngredientsList.tsx           # Pantry-aware ingredients list on recipe detail page
│   ├── RecipeShoppingCard.tsx              # Interactive shopping list card on recipe detail page
│   ├── LoadingChef.tsx                     # Loading animation for chef searches
│   ├── BottomNav.tsx                       # Mobile bottom navigation bar
│   └── Navbar.tsx                          # Legacy top navbar
├── convex/
│   ├── schema.ts                           # Database schema (recipes, favourites, customChefs, pantryItems, shoppingListItems) — userId-keyed, no users table
│   ├── auth.ts                             # requireUserId(ctx) — derives Clerk user ID from JWT
│   ├── auth.config.ts                      # JWT validator config (issuer = Clerk)
│   ├── recipes.ts                          # generateRecipes action (fallback) + saveRecipeSet mutation (API route) + getRecipeSet query — all authed
│   ├── chefs.ts                            # Chef's Table video search action (protein-aware filtering, dedup, up to 3 per chef)
│   ├── customChefs.ts                      # Custom chef CRUD + YouTube channel resolution — authed
│   ├── photos.ts                           # analyzePhoto action (Claude vision) — authed
│   ├── favourites.ts                       # save/remove/get favourites — authed
│   ├── pantry.ts                           # Pantry CRUD — authed, ownership checks on delete-by-ID
│   ├── shoppingList.ts                     # Shopping list CRUD — authed, ownership checks on delete-by-ID
│   └── _generated/                         # Auto-generated Convex bindings (committed)
├── hooks/
│   └── useAuthedUser.ts                    # Combines Clerk isLoaded + Convex JWT-attached readiness
├── lib/
│   ├── chefs.ts                            # Featured chef definitions + ChefSlot adapters
│   ├── chefSlots.ts                        # Chef's Table slot management (localStorage)
│   ├── searchHistory.ts                    # Search history storage (localStorage)
│   ├── ingredientParser.ts                 # Parses comma-separated ingredient text
│   ├── ingredientNameParser.ts             # Strips quantity/unit prefixes, splits compound ingredients
│   ├── pantryUtils.ts                      # Name normalization, alias resolution, category classification
│   ├── imageCompression.ts                 # Client-side Canvas image compression
│   ├── searchState.ts                      # Search state persistence (sessionStorage)
│   ├── parseYouTubeUrl.ts                  # YouTube URL/handle parser
│   └── voiceInput.ts                       # Voice input utility
├── types/
│   └── recipe.ts                           # Shared Recipe and RecipeFilters types
└── tests/
    ├── unit/                               # Component and utility unit tests
    ├── integration/                        # Convex function integration tests
    └── e2e/                                # Playwright end-to-end tests
```

---

## Local Development

### Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) account
- A [Clerk](https://dashboard.clerk.com) account (free tier is fine for development)
- An [Anthropic](https://console.anthropic.com) API key with credits
- A [YouTube Data API v3](https://console.cloud.google.com/apis/library/youtube.googleapis.com) key

### Setup

**1. Install dependencies**
```bash
npm install
```

**2. Create your Clerk application**
- Sign in to https://dashboard.clerk.com → create a new application (or use an existing one).
- Enable **Google** as a social connection (Configure → SSO connections).
- Under **Configure → JWT templates**, click **+ New template** and pick the **Convex** preset. **Name it exactly `convex`** (lowercase). Save. This is required — without it, `getToken({ template: "convex" })` returns 404 and Convex queries will fail with "Not authenticated".
- Copy the **Publishable Key** (`pk_test_...`) and **Secret Key** (`sk_test_...`) from Configure → API keys.
- Copy the **Issuer** URL from your JWT template (e.g., `https://singular-buffalo-90.clerk.accounts.dev`) — you'll need this for Convex.

**3. Start Convex (keep this running in a dedicated terminal)**
```bash
npx convex dev
```
This creates `.env.local` with `NEXT_PUBLIC_CONVEX_URL` automatically.

**4. Set environment variables in Convex**
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here
npx convex env set YOUTUBE_API_KEY your-youtube-api-key-here
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-instance.clerk.accounts.dev
```

**5. Populate `.env.local`** (copy from `.env.example`)
```
NEXT_PUBLIC_CONVEX_URL=...                 # set by `npx convex dev`
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
ANTHROPIC_API_KEY=sk-ant-api03-...         # also needed here for the /api/generate-recipes route
```

**6. Start the Next.js dev server (separate terminal)**
```bash
npm run dev
```

Open http://localhost:3000. Sign in with Google or email/password to exercise authenticated flows.

---

## Data Model

> **Note:** There is intentionally no `users` table. Clerk is the source of truth for identity (email, name, OAuth providers, session history). All user-owned tables store `userId: string` which is the Clerk user ID (e.g., `user_3CTg...`). A `users` table would be added only if a feature needs per-user server-side metadata that isn't already in Clerk (admin roles, notification prefs, analytics aggregates).

### `recipes` table
Stores one row per search — a set of 3 generated recipes.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Clerk user ID |
| `ingredients` | `string[]` | Ingredients the user entered |
| `filters` | `object` | `{ cuisine, maxCookingTime, difficulty, diet? }` |
| `results` | `any[]` | Array of 3 `Recipe` objects (JSON) |
| `generatedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_user`.

### `favourites` table
Tracks which recipes a user has saved.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Clerk user ID |
| `recipeSetId` | `Id<"recipes">` | References the recipes table |
| `recipeIndex` | `number` | 0, 1, or 2 — which of the 3 recipes |
| `savedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_user`, `by_user_and_recipe` (userId + recipeSetId + recipeIndex).

### `customChefs` table
Stores custom YouTube chefs added by a user.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Clerk user ID |
| `chefs` | `array` | Array of `{ channelId, channelName, channelThumbnail, addedAt, resolvedAt }` |
| `updatedAt` | `number` | Last modification timestamp |

Indexes: `by_user`.

### `pantryItems` table
Persistent pantry — ingredients the user always has on hand.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Clerk user ID |
| `name` | `string` | Display name, lowercase trimmed |
| `normalizedName` | `string` | For matching/dedup (depluralized, alias-resolved) |
| `category` | `string` | Auto-classified: `oils_fats`, `spices_powders`, `sauces_condiments`, `basics`, `other` |
| `createdAt` | `number` | `Date.now()` timestamp |
| `updatedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_user`, `by_user_and_name` (userId + normalizedName).

### `shoppingListItems` table
Items the user wants to buy.

| Field | Type | Description |
|---|---|---|
| `userId` | `string` | Clerk user ID |
| `name` | `string` | Display name |
| `normalizedName` | `string` | For matching/dedup |
| `source` | `string` | `manual` (typed in) or `recipe` (added from recipe page) |
| `createdAt` | `number` | `Date.now()` timestamp |
| `updatedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_user`, `by_user_and_name` (userId + normalizedName).

---

## Testing

```bash
# Unit tests (components + utilities)
npm run test:unit

# Integration tests (Convex functions, mocked Anthropic SDK)
npm run test:integration

# All Vitest tests
npm test

# End-to-end tests (requires dev server + npx convex dev running)
npm run test:e2e
```

**Test coverage:**
- `tests/unit/` — session utility, ingredient parser, ingredient name parser (compound splitting, quantity stripping), pantry utils (normalization, aliases, depluralization, category classification), image compression, RecipeCard, ChefGrid, ChefVideoCard, VideoModal, Sidebar, Navbar, BottomNav, IngredientInput, voice input, search state, search history, YouTube URL parser
- `tests/chefs-filter.test.mjs` — chef video filtering pipeline: stemming, protein detection, title matching (single-word and multi-word), deduplication, edge cases (0 results, >3 matches, return shape)
- `tests/integration/` — schema validation, favourites CRUD, analyzePhoto, generateRecipes, custom chefs CRUD
- `tests/e2e/` — Chef's Table tab switching and chef grid loading, chef selection persistence/restoration, Find Recipes button enable/disable states, ingredient submission → 3 results, save/remove favourite flow, My Chefs page (add input, parse errors, featured chefs, back link), voice/photo input UI, photo menu open/close

---

## Deployment

Production is hosted on **Vercel** (frontend) + **Convex** (backend). Every PR gets an isolated Vercel Preview deployment backed by an ephemeral Convex preview deployment.

### Deploy

```bash
npx vercel --prod
```

The Vercel build command is configured as:
```
npx convex deploy --cmd 'npm run build'
```
This deploys Convex functions first (regenerating `_generated/` bindings), then builds Next.js with the fresh bindings. For Preview deploys, Convex creates a fresh ephemeral deployment (e.g., `necessary-bird-659.convex.cloud`) per PR.

### Required Vercel environment variables

Add these in **Project Settings → Environment Variables** (Project tab, not Shared, unless you manage keys at the team level).

| Variable | Scope | Sensitive | Value / Source |
|---|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | All Environments | no | Production Convex URL (e.g. `https://helpful-loris-385.convex.cloud`). For Preview, the Convex integration rewrites this automatically to the ephemeral preview deployment URL at build time. |
| `CONVEX_DEPLOY_KEY` | **Production** only | yes | Production Deploy Key — Convex dashboard → **Project Settings** → **Production Deploy Keys** |
| `CONVEX_DEPLOY_KEY` | **Preview** only | yes | Preview Deploy Key — Convex dashboard → **Project Settings** → **Preview Deploy Keys** → generate one. Must be a separate entry from the Production key (Convex refuses to use a production key in a non-production build). |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview + Production | no (safe to expose) | Clerk → Configure → API keys (`pk_test_...` or `pk_live_...`) |
| `CLERK_SECRET_KEY` | Preview + Production | yes | Clerk → Configure → API keys (`sk_test_...` or `sk_live_...`) |
| `ANTHROPIC_API_KEY` | Preview + Production | yes | Anthropic console. Server-only (no `NEXT_PUBLIC_` prefix). |

**Important — Convex Default Environment Variables.** The `CLERK_JWT_ISSUER_DOMAIN`, `YOUTUBE_API_KEY`, and `ANTHROPIC_API_KEY` env vars must exist **inside Convex** (not just Vercel) so backend actions and `auth.config.ts` can read them. Preview Convex deployments are created fresh per PR and need these as **Default Environment Variables** in Convex dashboard → Project Settings → Environment Variables → **Default Environment Variables**. Add each with all three deployment types checked (Production, Preview, Development). These values are applied when a new preview deployment spins up; existing deployments are not affected retroactively.

```bash
# Set on the production Convex deployment directly:
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here --prod
npx convex env set YOUTUBE_API_KEY your-youtube-api-key-here --prod
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-instance.clerk.accounts.dev --prod
```

### Clerk setup required for every Clerk instance

Each Clerk instance (development, staging, production) needs:

1. **JWT template named `convex`** — Clerk dashboard → Configure → JWT templates → + New template → **Convex** preset → name it exactly `convex` (lowercase). Without this, `getToken({ template: "convex" })` returns 404 and nothing authed works.
2. (Recommended) **Email lockdown** — Configure → Email, Phone, Username → disable "Users can add email addresses". Users key off the stable Clerk user ID, but email changes complicate downstream analytics/notifications.

### Vercel Toolbar on preview deployments

Vercel auto-injects a dev toolbar on `.vercel.app` preview URLs for logged-in Vercel users. It does not appear on production and is not visible to end users.

---

## User Flows

### 0. Sign-in / sign-up
1. Unauth'd visitors can view the home page (ingredient input + Chef's Table grid) and generic pages.
2. The top-right nav shows a single orange **"Log in"** pill as the only auth CTA (no separate sign-up button). Rationale: OAuth collapses sign-in and sign-up into a single action, and Clerk's `<SignIn>` card already surfaces "Don't have an account? Sign up" as a footer link for first-time users.
3. Attempting a personalized action (generate recipes, save a favourite, visit `/favourites`, `/my-pantry`, `/my-shopping-list`, `/my-chefs`, or `/chef-results`) redirects to `/sign-in` via `middleware.ts` / `AuthGuard`.
4. Sign-in options: **Continue with Google** (OAuth) or email + password. New Google users are auto-created on first sign-in (Clerk default).
5. **Form state preservation.** If a signed-out visitor submits the Find Recipes form (text or Chef's Table), `handleSubmit` in `HomePage.tsx` saves their ingredients, active tab, and filters to `sessionStorage` via `saveSearchState` before redirecting to `/sign-in`. After authentication, Clerk's `forceRedirectUrl="/"` returns them to the home page, where the existing `loadSearchState` effect rehydrates all three. sessionStorage is tab-scoped and survives the OAuth round-trip to Google and back. Photo uploads are intentionally not preserved (base64 is too large for sessionStorage; cheap to re-upload).
6. After authentication, Clerk issues a session JWT. `ConvexProviderWithClerk` forwards the JWT to Convex on every query/mutation.
7. Top-right **UserButton** (Clerk component) opens the Manage Account modal (profile, security, connected accounts, sign out). There is intentionally no custom `/settings` page — Clerk handles it.

### 1. Text input flow
1. User enters ingredients as comma-separated text
2. Selects diet preference (Vegetarian / Vegan / Non-Vegetarian)
3. Optionally opens filters (cuisine, cooking time, difficulty)
4. Clicks **Find Recipes**
5. `/api/generate-recipes` API route streams Claude response → saves to Convex → returns ID (~28s)
6. Redirects to `/results/[id]` showing 3 recipe cards
7. User clicks a card → `/recipe/[id]/[index]` shows full detail

### 2. Photo input flow
1. User uploads a fridge photo (compressed client-side to ≤1024px)
2. `analyzePhoto` Convex Action sends image to Claude Vision → returns ingredient list
3. Extracted ingredients feed into `/api/generate-recipes` (same flow as above)

### 3. Chef's Table flow
1. User switches to the **Chef's Table** tab on the home page
2. A grid of slotted chefs appears (up to 8, from featured + custom)
3. User toggles which chefs to include in the current search
4. Enters ingredients and clicks **Find Recipes**
5. `searchChefVideos` Convex Action searches each chef's YouTube channel for up to 6 videos, then filters them by ingredient relevance:
   - **Protein-aware filtering:** If the input contains a protein (chicken, salmon, tofu, etc.), videos must mention that protein in their title. This prevents wrong-protein results (e.g., seabass showing up when the user searched for salmon).
   - **Flexible matching:** If no protein is detected (vegetables, eggs, carbs), any of the user's ingredients matching in the title is sufficient.
   - **Stem matching:** Handles plural differences (tomatoes↔tomato, noodles↔noodle). Multi-word ingredients (e.g., "soy sauce") match only as full phrases.
   - **Deduplication:** Exact duplicate titles (after stripping hashtags) are removed.
   - Up to 3 filtered videos are returned per chef. No padding with unrelated videos.
6. Results appear on `/chef-results` in a **section-per-chef layout** — each chef gets a header (emoji + name) followed by a responsive grid of video cards (1 col mobile, 2 col tablet, 3 col desktop)
7. Only relevant videos are shown — if a chef has 2 matches, 2 cards appear (no padding to fill 3)
8. Chefs with no matching videos show a "No matching videos for these ingredients" message
9. Tapping a card opens an **inline video modal** — the video plays in-app via YouTube embed (autoplay, 16:9, responsive sizing)
10. Modal includes a **Copy link** button to share the YouTube URL and a "Watch on YouTube" fallback link
11. Close via X button, backdrop click, or Escape key — then pick another video

### 4. My Chefs flow (roster management)
1. User navigates to `/my-chefs` (via "Edit chefs" link on Chef's Table, My Chefs icon in collapsed sidebar rail, or My Chefs link in the sidebar)
2. **Featured Chefs** section shows 8 built-in chefs in a 2×4 grid (mobile: 2-col, desktop: 4-col)
3. Tapping a card toggles it in/out of Chef's Table slots (max 8 total)
4. **Your Chefs** section shows custom YouTube chefs with remove buttons
5. User pastes a YouTube channel URL or @handle → "Find" resolves it via YouTube Data API
6. Preview card shown → "Add" saves to Convex and auto-adds to slots if under limit
7. Duplicate detection prevents adding a chef that's already in featured or custom lists
8. "← Back to search" navigates to `/?tab=chefs-table`, returning directly to the Chef's Table tab

### 5. Favourites flow
1. On recipe detail page, user clicks the heart button
2. `saveFavourite` mutation writes to DB; Convex real-time query updates the button instantly
3. `/favourites` page lists all saved recipes via `useQuery` (live updates)
4. Clicking the heart again calls `removeFavourite` — card disappears immediately

### 6. Back-navigation
1. User searches for recipes and lands on a results page
2. Hitting browser back returns to the home page with the correct tab already active (tab state is in the URL via `?tab=chefs-table`, so the server renders it correctly on first paint — no flash)
3. Ingredients and filters are restored from `sessionStorage` after mount
4. Entrance animations are skipped — the page loads instantly
5. Clicking **New Search** (sidebar or icon rail) clears the saved state and shows a clean home page
6. Closing the browser tab or opening a new tab always starts fresh (`sessionStorage` is tab-scoped). User-owned data (favourites, pantry, shopping list, chefs) lives in Convex keyed by Clerk user ID, so it persists across tabs, browsers, and devices once the user signs in.

### 7. Sidebar navigation
1. Hamburger button (mobile) or toggle button (desktop) opens the sidebar
2. **"fridge to table" logo** in the sidebar header is clickable — navigates to the home page
3. Sidebar shows: **New Search**, **My Chefs**, **Favorites**, **My Pantry**, **My Shopping List** nav links, searchable **Recent Searches** list
4. On desktop, a collapsed icon rail (48px) is always visible when sidebar is closed — provides quick access to New Search, My Chefs, Recent Searches, Favourites, My Pantry, and My Shopping List
5. On mobile, sidebar overlays the page with scroll isolation (main page doesn't scroll underneath)
6. On mobile, **swipe left to dismiss** with gesture intent lock — vertical scrolling through history items does not trigger horizontal swipe

### 8. My Pantry flow
1. User navigates to `/my-pantry` (via sidebar or icon rail)
2. Page shows items organized by auto-classified categories: Oils & Fats, Spices & Powders, Sauces & Condiments, Basics, Other
3. Each item appears as a pill with an × remove button
4. User types an item name and clicks **Add** (or presses Enter)
5. `addToPantry` mutation normalizes the name (lowercase, depluralize, resolve aliases like "chilli" → "chili", strip qualifiers like "fresh"/"dried"), auto-classifies into a category, and deduplicates atomically
6. If the item already exists, the existing pill highlights briefly and a message appears ("X is already in your pantry")
7. Removing an item shows an undo toast for 3 seconds — clicking "Undo" re-adds the item
8. Empty state: 🫙 emoji with helper text

### 9. My Shopping List flow
1. User navigates to `/my-shopping-list` (via sidebar or icon rail)
2. Page shows a flat list of items to buy
3. User types an item and clicks **Add** (or presses Enter)
4. `addToShoppingList` mutation normalizes and deduplicates
5. If item already exists, it highlights and a message appears
6. Removing an item fades it out with a 300ms animation
7. Empty state: 🛒 emoji with helper text

### 10. Recipe page pantry integration
1. On the recipe detail page, the **Ingredients** section is pantry-aware:
   - Items the user entered (from their fridge photo/text): green ✓ checkmark
   - Items found in the user's pantry: green • dot
   - Missing items: grey ○ circle
2. The **Shopping List** card below shows only items NOT in the user's pantry
   - Each item has a **+** button to add to the shopping list and an "already have it" link to add to the pantry
   - After adding to the shopping list, a ✓ appears with "added to list" — clicking ✓ removes it
   - After marking "already have it", the item disappears from the shopping list card (added to pantry)
   - If all items are in the pantry, the entire shopping list card is hidden
3. Compound ingredients (e.g. "to taste salt and pepper") are split and each part is matched individually against the pantry

---

## Homepage Testimonials

The homepage displays four user testimonials highlighting different aspects of the app:

1. **Priya M.** — Saving money by cooking at home instead of ordering takeout
2. **Emma R.** — Family bonding through cooking together
3. **Aisha K.** — Chef's Table feature: searching ingredients to discover chef videos
4. **Jason M.** — Using up leftover ingredients with smart recipe suggestions

---

## Known Limitations

- **Recipe generation takes ~28 seconds** — Claude Sonnet generates ~3000 tokens for 3 full recipes at ~80-100 tokens/second. This is a model speed constraint, not an architectural one. The API route uses streaming to keep the connection alive. Previous architecture through Convex Actions took ~40 seconds due to additional network latency.
- **Photo upload occasionally fails** — the Claude Vision → ingredient extraction flow can time out or return empty results on some images. Typing ingredients directly is more reliable.
- **No anonymous mode / no data migration** — All user-owned data requires sign-in. There is no anonymous session path. Pre-auth `sessionId`-keyed data was wiped when Clerk auth was introduced (pre-launch, zero real users). If a public demo path is ever added, it needs migration designed up front.
- **No retention policy** — Recipe search history, favourites, pantry, shopping list, and custom chefs accumulate indefinitely per user. A cleanup cron for old non-favourited recipe searches is in the backlog.
- **No cascade on account deletion** — Deleting a Clerk account does not automatically purge the user's Convex data. A Clerk webhook → Convex wipe-by-userId is in the backlog (required for launch from a legal/compliance perspective).
- **Duplicated normalization logic** — pantry/shopping list name normalization is implemented in both `lib/pantryUtils.ts` (client-side for UI matching) and `convex/pantry.ts` / `convex/shoppingList.ts` (server-side for atomic dedup). Changes to normalization rules must be applied in both places. This is a Convex isolation constraint — backend functions cannot import from Next.js `lib/`.
- **No pagination** — the results page always shows exactly 3 recipes per search.
- **Custom chef limit** — max 6 custom YouTube chefs per session (in addition to 8 featured chefs).
- **Chef's Table slot limit** — max 8 chefs can be active on Chef's Table at a time.
- **YouTube API result cap** — the YouTube Search API occasionally returns more results than `maxResults`. A server-side `.slice(0, 6)` in `convex/chefs.ts` caps the raw pool, and post-filtering `.slice(0, 3)` guarantees no more than 3 videos per chef.
- **Chef's Table relevance filtering is title-based** — video relevance is determined by matching ingredient names against video titles. Videos whose titles don't mention the searched ingredients are filtered out. This is effective for protein-specific searches but may miss videos with creative/non-literal titles.

---

## Environment Variables

A consolidated view of every variable, where it lives, and what uses it. See **Deployment** above for Vercel scoping rules.

### Next.js runtime (local `.env.local` + Vercel)

| Variable | Public? | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | yes | Convex deployment URL (auto-set locally by `npx convex dev`; Vercel sets this per environment via Convex integration) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | Clerk publishable key (`pk_test_...` / `pk_live_...`). Safe to expose — it only identifies your Clerk instance. |
| `CLERK_SECRET_KEY` | **no** (server-only) | Clerk secret key (`sk_test_...` / `sk_live_...`). Never prefixed with `NEXT_PUBLIC_`. |
| `ANTHROPIC_API_KEY` | **no** (server-only) | Used by `/api/generate-recipes` to call Claude directly from the Next.js server |

### Vercel-only (build-time)

| Variable | Scope | Description |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | Production | Production deploy key from Convex dashboard → Project Settings → Production Deploy Keys |
| `CONVEX_DEPLOY_KEY` | Preview | Preview deploy key (separate entry) — generates an ephemeral Convex backend per PR |

### Convex runtime (set via `npx convex env set` or Project Settings → Environment Variables)

| Variable | Where set | Description |
|---|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | Convex — Default Env Vars (checked for Prod/Preview/Dev) | Used by `convex/auth.config.ts` to validate Clerk JWTs. Must exactly match your Clerk instance's Issuer URL (no trailing slash). |
| `ANTHROPIC_API_KEY` | Convex — Default Env Vars | Used by `convex/photos.ts` (vision) and `convex/recipes.ts` (fallback action) |
| `YOUTUBE_API_KEY` | Convex — Default Env Vars | Used by `convex/chefs.ts` and `convex/customChefs.ts` for video search / channel resolution |

> **Secret-exposure model:** Only `NEXT_PUBLIC_*` values are sent to the browser. Everything else is server-only. Convex env vars are accessible only inside Convex functions (never sent to the client).
>
> **Adding a new Convex env var to all future preview deployments:** set it under Convex Project Settings → Environment Variables → Default Environment Variables. Existing preview deployments are not updated retroactively; push a new commit to the PR to create a fresh one.

---

## Post-Deployment Checklist

After every production deployment, update the following to reflect any changes:

1. **README.md** — Overview, project structure, user flows, known limitations
2. **Data Model** — Schema tables, fields, and indexes
3. **Architecture diagrams** — System architecture, data flow, and component relationships

---

## Future Work

- **Data retention cron** — auto-delete `recipes` rows older than 90 days that are not referenced by any `favourites` entry
- **Account deletion cascade** — Clerk webhook on `user.deleted` → Convex action that wipes all rows matching the Clerk user ID (GDPR / CCPA requirement before public launch)
- **Separate production Clerk + Convex instances** — currently dev-mode Clerk keys and the dev Convex deployment double as production. Stand up a prod Clerk application and a prod Convex deployment before onboarding real users.
- Share a recipe via URL (public deep-link that doesn't require sign-in to view)
- Nutritional information per recipe
