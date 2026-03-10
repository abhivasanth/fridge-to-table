# Fridge to Table

A recipe suggestion web app that generates personalised recipes from the ingredients you already have. Powered by Claude AI.

**Live:** https://fridge-to-table-mu.vercel.app

---

## Overview

Fridge to Table lets users input their available ingredients — either by typing a comma-separated list or uploading a fridge photo — and instantly receive three tailored recipe suggestions. Users can filter by diet (vegetarian, vegan, non-vegetarian), cuisine style, cooking time, and difficulty. Recipes include step-by-step instructions, an ingredients list (flagging what you already have), and a shopping list for anything missing.

The app features a **Chef's Table** mode where users can get recipes styled after popular cooking creators (8 featured chefs + up to 6 custom YouTube channels). A collapsible **sidebar** provides quick access to search history, favourites, and new searches. Favourites can be saved and revisited — no account required.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Next.js 16 (Vercel)                │
│  App Router · TypeScript · Tailwind CSS         │
│  Pure UI layer — no server logic here           │
└───────────────────┬─────────────────────────────┘
                    │  Convex React SDK
                    ▼
┌─────────────────────────────────────────────────┐
│              Convex (Backend)                   │
│  Actions · Mutations · Queries · Database       │
│  All Claude API calls happen here               │
└───────────────────┬─────────────────────────────┘
                    │  Anthropic SDK
                    ▼
┌─────────────────────────────────────────────────┐
│           Claude Sonnet 4.6 (Anthropic)         │
│  Vision: ingredient extraction from photos      │
│  Chat: recipe generation from ingredients       │
└─────────────────────────────────────────────────┘
```

**Key design decisions:**

- **Convex as the only backend.** All Claude API calls are made inside Convex Actions — never from the browser. This keeps the Anthropic API key secure and off the client.
- **Anonymous sessions.** A UUID is generated on first visit and stored in `localStorage`. No login required. Favourites are scoped to this session ID.
- **Server components for data pages.** The results and recipe detail pages are Next.js Server Components using `fetchQuery` — data is fetched before the page renders, eliminating loading spinners.
- **Real-time favourites.** `useQuery` from Convex provides live updates — saving or removing a favourite reflects instantly without a page refresh.
- **Two-tier chef selection.** Chef's Table slots (which chefs appear) are stored in `localStorage`. Per-search toggles (which slotted chefs to include) are transient UI state. This keeps the roster persistent without extra DB writes.
- **Search state persistence.** Ingredients, tab, and filters are saved to `sessionStorage` on submit. Back-navigation restores them; "New Search" and new tabs/windows start fresh.
- **Server/Client Component split for hydration safety.** The home page (`app/page.tsx`) is a Server Component that reads `searchParams` and passes `initialTab` as a prop to the Client Component (`components/HomePage.tsx`). This ensures the first render is deterministic — no hydration mismatches from client-only state like `sessionStorage` or `useSearchParams`.
- **Conditional entrance animations.** Hero and card animations play only on the first visit per session. Animation state is deferred to `useEffect` (initialized as `false`, enabled after mount) to prevent server/client markup divergence. Return visits (back-nav, New Search) load instantly without animation delays.
- **Gesture intent lock (mobile sidebar).** Swipe-to-dismiss uses a 12px dead zone to disambiguate scroll vs swipe. Once the dominant axis is determined, the gesture locks — vertical scrolling never triggers horizontal panel movement.
- **YouTube channel resolution.** Custom chefs are resolved via YouTube Data API (called from Convex Action) — the client never touches external APIs directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
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
├── app/
│   ├── layout.tsx                          # Root layout with ConvexClientProvider
│   ├── page.tsx                            # Server Component — derives initialTab from searchParams
│   ├── results/[recipeSetId]/page.tsx      # Results page (3 recipe cards)
│   ├── recipe/[recipeSetId]/[recipeIndex]/ # Recipe detail page
│   ├── chef-results/[recipeSetId]/page.tsx # Chef's Table results page
│   ├── favourites/page.tsx                 # Saved favourites page
│   └── my-chefs/page.tsx                   # Manage chef roster (featured + custom)
├── components/
│   ├── HomePage.tsx                        # Client Component — home page (ingredients, filters, Chef's Table)
│   ├── ConvexClientProvider.tsx            # Wraps app with Convex context
│   ├── ClientNav.tsx                       # Top nav + collapsed icon rail (desktop)
│   ├── Sidebar.tsx                         # Slide-out sidebar (history, favourites, new search)
│   ├── IngredientInput.tsx                 # Text/photo input + diet filter
│   ├── FiltersPanel.tsx                    # Collapsible cuisine/time/difficulty filters
│   ├── ChefGrid.tsx                        # Multi-select grid of chefs for Chef's Table tab
│   ├── ChefVideoCard.tsx                   # Video card for chef-style results
│   ├── VideoModal.tsx                      # Inline YouTube player modal overlay
│   ├── CustomChefCard.tsx                  # Preview card when adding a custom YouTube chef
│   ├── RecipeCard.tsx                      # Recipe summary card (links to detail)
│   ├── FavouriteButton.tsx                 # Heart toggle (save/remove)
│   ├── FavouritesGrid.tsx                  # Grid of saved recipes
│   ├── LoadingChef.tsx                     # Loading animation for chef searches
│   ├── BottomNav.tsx                       # Mobile bottom navigation bar
│   └── Navbar.tsx                          # Legacy top navbar
├── convex/
│   ├── schema.ts                           # Database schema (recipes, favourites, customChefs)
│   ├── recipes.ts                          # generateRecipes action + getRecipeSet query
│   ├── chefs.ts                            # Chef's Table recipe generation action
│   ├── customChefs.ts                      # Custom chef CRUD + YouTube channel resolution
│   ├── photos.ts                           # analyzePhoto action (Claude vision)
│   ├── favourites.ts                       # save/remove/get favourites
│   └── _generated/                         # Auto-generated Convex bindings (committed)
├── lib/
│   ├── session.ts                          # Anonymous session ID (localStorage)
│   ├── chefs.ts                            # Featured chef definitions + ChefSlot adapters
│   ├── chefSlots.ts                        # Chef's Table slot management (localStorage)
│   ├── searchHistory.ts                    # Search history storage (localStorage)
│   ├── ingredientParser.ts                 # Parses comma-separated ingredient text
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
- An [Anthropic](https://console.anthropic.com) API key with credits

### Setup

**1. Install dependencies**
```bash
npm install
```

**2. Start Convex (keep this running in a dedicated terminal)**
```bash
npx convex dev
```
This creates `.env.local` with `NEXT_PUBLIC_CONVEX_URL` automatically.

**3. Set API keys in Convex**
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here
npx convex env set YOUTUBE_API_KEY your-youtube-api-key-here
```

**4. Start the Next.js dev server (separate terminal)**
```bash
npm run dev
```

Open http://localhost:3000.

---

## Data Model

### `recipes` table
Stores one row per search — a set of 3 generated recipes.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Anonymous user UUID |
| `ingredients` | `string[]` | Ingredients the user entered |
| `filters` | `object` | `{ cuisine, maxCookingTime, difficulty, diet? }` |
| `results` | `any[]` | Array of 3 `Recipe` objects (JSON) |
| `generatedAt` | `number` | `Date.now()` timestamp |

### `favourites` table
Tracks which recipes a session has saved.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Anonymous user UUID |
| `recipeSetId` | `Id<"recipes">` | References the recipes table |
| `recipeIndex` | `number` | 0, 1, or 2 — which of the 3 recipes |
| `savedAt` | `number` | `Date.now()` timestamp |

### `customChefs` table
Stores custom YouTube chefs added by a session.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Anonymous user UUID |
| `chefs` | `array` | Array of `{ channelId, channelName, channelThumbnail, addedAt, resolvedAt }` |
| `updatedAt` | `number` | Last modification timestamp |

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
- `tests/unit/` — session utility, ingredient parser, image compression, RecipeCard component
- `tests/integration/` — schema validation, favourites CRUD, analyzePhoto, generateRecipes
- `tests/e2e/` — button states, ingredient submission → 3 results, save/remove favourite flow

---

## Deployment

Production is hosted on **Vercel** (frontend) + **Convex** (backend).

### Deploy

```bash
npx vercel --prod
```

The Vercel build command is configured as:
```
npx convex deploy --cmd 'npm run build'
```
This deploys Convex functions first (regenerating `_generated/` bindings), then builds Next.js with the fresh bindings.

### Required Vercel environment variables

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Your production Convex URL (e.g. `https://helpful-loris-385.convex.cloud`) |
| `CONVEX_DEPLOY_KEY` | Production deploy key from Convex dashboard → Settings → Deploy Keys |

### Set API keys in production Convex

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here --prod
npx convex env set YOUTUBE_API_KEY your-youtube-api-key-here --prod
```

---

## User Flows

### 1. Text input flow
1. User enters ingredients as comma-separated text
2. Selects diet preference (Vegetarian / Vegan / Non-Vegetarian)
3. Optionally opens filters (cuisine, cooking time, difficulty)
4. Clicks **Find Recipes**
5. `generateRecipes` Convex Action calls Claude → saves to DB → returns ID
6. Redirects to `/results/[id]` showing 3 recipe cards
7. User clicks a card → `/recipe/[id]/[index]` shows full detail

### 2. Photo input flow
1. User uploads a fridge photo (compressed client-side to ≤1024px)
2. `analyzePhoto` Convex Action sends image to Claude Vision → returns ingredient list
3. Extracted ingredients feed into `generateRecipes` (same flow as above)

### 3. Chef's Table flow
1. User switches to the **Chef's Table** tab on the home page
2. A grid of slotted chefs appears (up to 8, from featured + custom)
3. User toggles which chefs to include in the current search
4. Enters ingredients and clicks **Find Recipes**
5. Recipes are generated in the style of the selected chefs
6. Results appear on `/chef-results` as video cards
7. Tapping a card opens an **inline video modal** — the video plays in-app via YouTube embed (autoplay, 16:9, responsive sizing)
8. Modal includes a **Copy link** button to share the YouTube URL and a "Watch on YouTube" fallback link
9. Close via X button, backdrop click, or Escape key — then pick another video

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
2. Hitting browser back returns to the home page with ingredients, tab, and filters restored from `sessionStorage`
3. Entrance animations are skipped — the page loads instantly
4. Clicking **New Search** (sidebar or icon rail) clears the saved state and shows a clean home page
5. Closing the browser tab or opening a new tab always starts fresh (`sessionStorage` is tab-scoped)

### 7. Sidebar navigation
1. Hamburger button (mobile) or toggle button (desktop) opens the sidebar
2. **"fridge to table" logo** in the sidebar header is clickable — navigates to the home page
3. Sidebar shows: **New Search**, **My Chefs**, **Favorites** nav links, searchable **Recent Searches** list
4. On desktop, a collapsed icon rail (48px) is always visible when sidebar is closed — provides quick access to New Search, My Chefs, Recent Searches, and Favourites
5. On mobile, sidebar overlays the page with scroll isolation (main page doesn't scroll underneath)
6. On mobile, **swipe left to dismiss** with gesture intent lock — vertical scrolling through history items does not trigger horizontal swipe

---

## Known Limitations

- **Photo upload occasionally fails** — the Claude Vision → ingredient extraction flow can time out or return empty results on some images. Typing ingredients directly is more reliable.
- **Session-scoped data** — clearing `localStorage` or switching browsers loses favourites, chef slots, and search history. A future auth layer would persist these across devices.
- **No pagination** — the results page always shows exactly 3 recipes per search.
- **Custom chef limit** — max 6 custom YouTube chefs per session (in addition to 8 featured chefs).
- **Chef's Table slot limit** — max 8 chefs can be active on Chef's Table at a time.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL (auto-created by `npx convex dev`) |
| `ANTHROPIC_API_KEY` | Convex environment | Anthropic API key — set via `npx convex env set` |
| `YOUTUBE_API_KEY` | Convex environment | YouTube Data API v3 key — used for custom chef channel resolution |

> The Anthropic and YouTube API keys are **never** exposed to the browser. They live exclusively in Convex's secure environment and are only accessed inside Convex Actions.

---

## Post-Deployment Checklist

After every production deployment, update the following to reflect any changes:

1. **README.md** — Overview, project structure, user flows, known limitations
2. **Data Model** — Schema tables, fields, and indexes
3. **Architecture diagrams** — System architecture, data flow, and component relationships

---

## Future Work

- Add user authentication to persist data across devices/browsers
- Share a recipe via URL
- Nutritional information per recipe
