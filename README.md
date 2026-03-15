# Fridge to Table

A recipe suggestion web app that generates personalised recipes from the ingredients you already have. Powered by Claude AI.

**Live:** https://fridge-to-table-mu.vercel.app

---

## Overview

Fridge to Table lets users input their available ingredients — either by typing a comma-separated list or uploading a fridge photo — and instantly receive three tailored recipe suggestions. Users can filter by diet (vegetarian, vegan, non-vegetarian), cuisine style, cooking time, and difficulty. Recipes include step-by-step instructions, a pantry-aware ingredients list, and an interactive shopping list card for anything missing.

The app features a **Chef's Table** mode where users can discover up to 3 most relevant YouTube recipe videos per chef from popular cooking creators (8 featured chefs + up to 6 custom YouTube channels). A collapsible **sidebar** provides quick access to search history, favourites, pantry, shopping list, and new searches. Favourites can be saved and revisited — no account required.

Users can manage a persistent **My Pantry** of staple ingredients they always have on hand, and a **My Shopping List** of items to buy. Recipe pages are pantry-aware — ingredients already in the pantry are highlighted, and the shopping list card automatically hides pantry items.

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
- **Anonymous sessions.** A UUID is generated on first visit and stored in `localStorage`. No login required. Favourites, pantry items, and shopping list are scoped to this session ID.
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
│   ├── chef-results/page.tsx              # Chef's Table results page (section-per-chef layout)
│   ├── favourites/page.tsx                 # Saved favourites page
│   ├── my-chefs/page.tsx                   # Manage chef roster (featured + custom)
│   ├── my-pantry/page.tsx                  # My Pantry page (persistent staple ingredients)
│   └── my-shopping-list/page.tsx           # My Shopping List page (items to buy)
├── components/
│   ├── HomePage.tsx                        # Client Component — home page (ingredients, filters, Chef's Table)
│   ├── ConvexClientProvider.tsx            # Wraps app with Convex context
│   ├── ClientNav.tsx                       # Top nav + collapsed icon rail (desktop)
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
│   ├── schema.ts                           # Database schema (recipes, favourites, customChefs, pantryItems, shoppingListItems)
│   ├── recipes.ts                          # generateRecipes action + getRecipeSet query
│   ├── chefs.ts                            # Chef's Table video search action (up to 3 per chef)
│   ├── customChefs.ts                      # Custom chef CRUD + YouTube channel resolution
│   ├── photos.ts                           # analyzePhoto action (Claude vision)
│   ├── favourites.ts                       # save/remove/get favourites
│   ├── pantry.ts                           # Pantry CRUD (add/remove/get, auto-classify, dedup)
│   ├── shoppingList.ts                     # Shopping list CRUD (add/remove/get, dedup)
│   └── _generated/                         # Auto-generated Convex bindings (committed)
├── lib/
│   ├── session.ts                          # Anonymous session ID (localStorage)
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

### `pantryItems` table
Persistent pantry — ingredients the user always has on hand.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Anonymous user UUID |
| `name` | `string` | Display name, lowercase trimmed |
| `normalizedName` | `string` | For matching/dedup (depluralized, alias-resolved) |
| `category` | `string` | Auto-classified: `oils_fats`, `spices_powders`, `sauces_condiments`, `basics`, `other` |
| `createdAt` | `number` | `Date.now()` timestamp |
| `updatedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_session`, `by_session_and_name` (sessionId + normalizedName).

### `shoppingListItems` table
Items the user wants to buy.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Anonymous user UUID |
| `name` | `string` | Display name |
| `normalizedName` | `string` | For matching/dedup |
| `source` | `string` | `manual` (typed in) or `recipe` (added from recipe page) |
| `createdAt` | `number` | `Date.now()` timestamp |
| `updatedAt` | `number` | `Date.now()` timestamp |

Indexes: `by_session`, `by_session_and_name` (sessionId + normalizedName).

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
- `tests/integration/` — schema validation, favourites CRUD, analyzePhoto, generateRecipes, custom chefs CRUD
- `tests/e2e/` — Chef's Table tab switching and chef grid loading, chef selection persistence/restoration, Find Recipes button enable/disable states, ingredient submission → 3 results, save/remove favourite flow, My Chefs page (add input, parse errors, featured chefs, back link), voice/photo input UI, photo menu open/close

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
5. `searchChefVideos` Convex Action searches each chef's YouTube channel for up to 3 most relevant videos matching the ingredients
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
6. Closing the browser tab or opening a new tab always starts fresh (`sessionStorage` is tab-scoped)

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

- **Photo upload occasionally fails** — the Claude Vision → ingredient extraction flow can time out or return empty results on some images. Typing ingredients directly is more reliable.
- **Session-scoped data** — clearing `localStorage` or switching browsers loses favourites, chef slots, search history, pantry items, and shopping list. A future auth layer would persist these across devices.
- **Duplicated normalization logic** — pantry/shopping list name normalization is implemented in both `lib/pantryUtils.ts` (client-side for UI matching) and `convex/pantry.ts` / `convex/shoppingList.ts` (server-side for atomic dedup). Changes to normalization rules must be applied in both places. This is a Convex isolation constraint — backend functions cannot import from Next.js `lib/`.
- **No pagination** — the results page always shows exactly 3 recipes per search.
- **Custom chef limit** — max 6 custom YouTube chefs per session (in addition to 8 featured chefs).
- **Chef's Table slot limit** — max 8 chefs can be active on Chef's Table at a time.
- **YouTube API result cap** — the YouTube Search API occasionally returns more results than `maxResults`. A server-side `.slice(0, 3)` in `convex/chefs.ts` guarantees no more than 3 videos per chef regardless of API behavior.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL (auto-created by `npx convex dev`) |
| `ANTHROPIC_API_KEY` | Convex environment | Anthropic API key — set via `npx convex env set` |
| `YOUTUBE_API_KEY` | Convex environment | YouTube Data API v3 key — used for Chef's Table video search and custom chef channel resolution |

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
