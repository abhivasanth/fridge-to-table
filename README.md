# Fridge to Table

A recipe suggestion web app that generates personalised recipes from the ingredients you already have. Powered by Claude AI.

**Live:** https://fridge-to-table-mu.vercel.app

---

## Overview

Fridge to Table lets users input their available ingredients — either by typing a comma-separated list or uploading a fridge photo — and instantly receive three tailored recipe suggestions. Users can filter by diet (vegetarian, vegan, non-vegetarian), cuisine style, cooking time, and difficulty. Recipes include step-by-step instructions, an ingredients list (flagging what you already have), and a shopping list for anything missing. Favourites can be saved and revisited — no account required.

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
| Hosting | Vercel (frontend) + Convex (backend) |

---

## Project Structure

```
fridge_to_table/
├── app/
│   ├── layout.tsx                          # Root layout with ConvexClientProvider
│   ├── page.tsx                            # Home page (ingredient input + filters)
│   ├── results/[recipeSetId]/page.tsx      # Results page (3 recipe cards)
│   ├── recipe/[recipeSetId]/[recipeIndex]/ # Recipe detail page
│   └── favourites/page.tsx                 # Saved favourites page
├── components/
│   ├── ConvexClientProvider.tsx            # Wraps app with Convex context
│   ├── IngredientInput.tsx                 # Text/photo input + diet filter
│   ├── FiltersPanel.tsx                    # Collapsible cuisine/time/difficulty filters
│   ├── RecipeCard.tsx                      # Recipe summary card (links to detail)
│   ├── FavouriteButton.tsx                 # Heart toggle (save/remove)
│   └── FavouritesGrid.tsx                  # Grid of saved recipes
├── convex/
│   ├── schema.ts                           # Database schema (recipes + favourites)
│   ├── recipes.ts                          # generateRecipes action + getRecipeSet query
│   ├── photos.ts                           # analyzePhoto action (Claude vision)
│   ├── favourites.ts                       # save/remove/get favourites
│   └── _generated/                         # Auto-generated Convex bindings (committed)
├── lib/
│   ├── session.ts                          # Anonymous session ID (localStorage)
│   ├── ingredientParser.ts                 # Parses comma-separated ingredient text
│   └── imageCompression.ts                 # Client-side Canvas image compression
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

**3. Set the Anthropic API key in Convex**
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here
```

**4. Start the Next.js dev server (separate terminal)**
```bash
npm run dev
```

Open http://localhost:3000.

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Convex deployment URL (auto-created by `npx convex dev`) |
| `ANTHROPIC_API_KEY` | Convex environment | Anthropic API key — set via `npx convex env set` |

> The Anthropic API key is **never** exposed to the browser. It lives exclusively in Convex's secure environment and is only accessed inside Convex Actions.

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

### Set Anthropic API key in production Convex

```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-your-key-here --prod
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

### 3. Favourites flow
1. On recipe detail page, user clicks the heart button
2. `saveFavourite` mutation writes to DB; Convex real-time query updates the button instantly
3. `/favourites` page lists all saved recipes via `useQuery` (live updates)
4. Clicking the heart again calls `removeFavourite` — card disappears immediately

---

## Known Limitations

- **Photo upload occasionally fails** — the Claude Vision → ingredient extraction flow can time out or return empty results on some images. Typing ingredients directly is more reliable. (To be investigated.)
- **Session-scoped favourites** — clearing `localStorage` or switching browsers loses saved recipes. A future auth layer would persist these across devices.
- **No pagination** — the results page always shows exactly 3 recipes per search.

---

## Future Work

- Investigate and fix photo upload reliability issue
- Add user authentication to persist favourites across devices/browsers
- Recipe history page (view past searches)
- Share a recipe via URL
- Nutritional information per recipe
