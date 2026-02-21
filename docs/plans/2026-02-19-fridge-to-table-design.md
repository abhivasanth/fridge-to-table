# Fridge to Table — Design Document

**Date:** 2026-02-19
**Last updated:** 2026-02-21
**Status:** Shipped ✅

---

## Overview

A recipe suggestion web app. Users input what's in their fridge — by typing ingredients or uploading a photo — and the app suggests 3 personalised recipes with everything they need to get cooking immediately. Supports vegetarian, vegan, and non-vegetarian diets.

---

## Architecture & Stack

| Layer | Technology |
|---|---|
| Frontend + Routing | Next.js 16 (App Router) |
| Styling | Tailwind CSS |
| Backend / DB | Convex (Actions, Mutations, Queries) |
| AI | Claude Sonnet 4.6 (`claude-sonnet-4-6`) — vision + recipe generation |
| Hosting | Vercel (frontend) + Convex (backend) |
| Language | TypeScript throughout |
| Unit/Integration Tests | Vitest, React Testing Library, `convex-test` |
| E2E Tests | Playwright |

**Key architectural decisions:**
- All Claude API calls happen inside Convex Actions — server-side only, never in the browser
- Claude API key lives exclusively in Convex environment variables
- Next.js is a pure UI layer using Convex React hooks
- Anonymous session identity: UUID generated on first visit, persisted in `localStorage`
- No user accounts, no login, no server-side sessions
- `localStorage` access is guarded with `typeof window === "undefined"` for SSR safety
- Convex `"skip"` pattern used for conditional queries when session ID is unavailable (SSR)

---

## Data Model

```typescript
// convex/schema.ts

recipes: {
  sessionId: string           // anonymous user UUID
  ingredients: string[]       // from text input or photo analysis
  filters: {
    cuisine: string           // free-text: "Italian", "spicy", "comfort food"
    maxCookingTime: number    // minutes
    difficulty: "easy" | "medium" | "hard"
    diet?: "vegetarian" | "vegan" | "non-vegetarian"  // optional for backwards compatibility
  }
  results: Recipe[]           // array of exactly 3
  generatedAt: number         // timestamp
}

favourites: {
  sessionId: string
  recipeSetId: Id<"recipes">  // reference to the recipes table
  recipeIndex: number         // 0, 1, or 2 — which of the 3 recipes
  savedAt: number
}
```

```typescript
// types/recipe.ts — shared Recipe type (stored as JSON inside recipes.results[])
type Recipe = {
  title: string
  description: string             // 1-2 sentence hook
  cookingTime: number             // minutes
  difficulty: "easy" | "medium" | "hard"
  servings: number
  cuisineType: string
  ingredients: {
    name: string
    amount: string
    inFridge: boolean             // true = user already has this
  }[]
  steps: string[]                 // numbered cooking instructions
  shoppingList: string[]          // ingredients the user needs to buy
  uncertainIngredients?: string[] // flagged uncertain items from photo analysis
}

type RecipeFilters = {
  cuisine: string
  maxCookingTime: number
  difficulty: "easy" | "medium" | "hard"
  diet: "vegetarian" | "vegan" | "non-vegetarian"
}
```

**No `sessions` table** — session IDs are just a field on records. No separate entity needed.

---

## Pages & User Flow

### `GET /` — Home
- Hero: app name + tagline
- Input section with tab toggle:
  - **"Type ingredients"** tab: textarea, comma-separated ingredient list
  - **"Upload photo"** tab: drag-and-drop or click-to-upload; image compressed client-side to ≤1024px using Canvas API before sending to Convex
- **Diet filter** (prominent, always visible — before the Find Recipes button):
  - Three toggle buttons: **Vegetarian** / **Vegan** / **Non-Vegetarian**
  - Defaults to Vegetarian
- Optional filters (collapsible panel, below diet filter):
  - Cuisine mood: free-text field (`placeholder="e.g. Italian, spicy, comfort food"`)
  - Max cooking time: 15 / 30 / 45 / 60+ min selector
  - Difficulty: Easy / Medium / Hard toggle
- **[Find Recipes]** CTA — disabled until ≥1 ingredient present
- Loading state: bouncing chef emoji while Convex Action runs

### `GET /results/[recipeSetId]` — Results
- 3 recipe cards in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Each card: title, cuisine type badge, difficulty badge, cooking time, short description
- Click any card → recipe detail page
- Back link → home ("← New search")
- Footer link → favourites page

### `GET /recipe/[recipeSetId]/[recipeIndex]` — Recipe Detail
- Title + ♥ Save to Favourites button (toggles saved state in real-time via Convex)
- Metadata badges: cuisine, cooking time, servings, difficulty
- Short description
- Ingredient list: ticked (✓) for items in fridge, greyed (○) for missing items
- Step-by-step numbered instructions
- Shopping list (amber card) — only shown if items to buy exist
- Uncertainty notice banner — only shown if photo analysis flagged uncertain ingredients

### `GET /favourites` — Favourites
- Grid of saved recipe cards for this session (real-time via `useQuery`)
- Remove button (♥) on each card — disappears instantly on click
- Empty state with CTA back to home
- Loading state while Convex query resolves

---

## Claude API Integration

### Step 1 — Photo Analysis (only when photo uploaded)

```
Model: claude-sonnet-4-6
Input: base64-encoded image (compressed ≤1024px client-side before sending)

Prompt:
"Analyse this fridge photo for a recipe app.
List every food ingredient you can identify.
All ingredients are assumed vegetarian. Only add an ingredient to the "uncertain"
list if it could plausibly be a meat or fish product (e.g. a broth that could be
meat-based, an unlabelled sausage, or an unidentifiable protein). Never flag spices,
condiments, herbs, salt, pepper, oils, vinegars, dairy, eggs, fruit, vegetables,
grains, or any ingredient that is obviously vegetarian.
Return JSON only, no other text: { "ingredients": string[], "uncertain": string[] }"
```

### Step 2 — Recipe Generation

```
Model: claude-sonnet-4-6
Input: ingredients[], filters (including diet preference)

Prompt:
"You are a creative chef generating recipe suggestions.

The user has these ingredients: [comma-separated list].
Generate exactly 3 recipes using mostly these ingredients.
Diet preference: [one of the diet instructions below]
Cuisine style: [cuisine, or 'any style'].
Maximum cooking time: [N] minutes.
Difficulty level: [easy|medium|hard].

For each recipe:
- Set inFridge: true for ingredients the user already has
- List any additional required ingredients in shoppingList
- If you need to slightly exceed the time or difficulty to give good results,
  do so and briefly note it in the description

Return a JSON array of exactly 3 recipes. No other text."
```

**Diet instruction injected at runtime:**
- Vegetarian: "All recipes must be vegetarian (no meat or fish, but dairy and eggs are fine)."
- Vegan: "All recipes must be strictly vegan (no meat, fish, dairy, or eggs)."
- Non-vegetarian: "Recipes can include meat, fish, or any other ingredients — non-vegetarian is welcome."

**Important:** Claude sometimes wraps JSON in markdown code fences (` ```json `). The response is stripped of these before `JSON.parse`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Photo too large | Client-side Canvas compression runs before upload — never reaches Convex |
| Photo unreadable / Claude returns no ingredients | Error message: "We couldn't detect many ingredients — try typing them instead." |
| Zero ingredients entered | [Find Recipes] button disabled |
| Claude API failure / timeout | Error message: "Our chef is taking a break — please try again in a moment." with dismiss button |
| Recipe set not found | `/results` and `/recipe` pages show "not found" state with link home |
| localStorage unavailable (SSR) | `getSessionId()` returns `""` — Convex queries skip via `"skip"` pattern |

---

## UI Design

- **Colour palette:** Clean whites, soft greens (`green-50` to `green-600`), warm amber accents for shopping list
- **Typography:** Inter (Google Fonts), large comfortable sizing
- **Cards:** Rounded-2xl corners, subtle shadows, hover transitions
- **Feel:** Premium consumer app — smooth transitions, considered interactions
- **Responsive:** Mobile-first; single column on mobile, 2-3 column grid on tablet/desktop
- **Accessibility:** `aria-label` on icon-only buttons, sufficient contrast, keyboard navigable

---

## Deployment

### Infrastructure
- **Frontend:** Vercel (auto-deploy via CLI)
- **Backend:** Convex managed cloud
- **URLs:**
  - Production: https://fridge-to-table-mu.vercel.app
  - Convex prod: https://helpful-loris-385.convex.cloud
  - GitHub: https://github.com/abhivasanth/fridge-to-table

### Deploy command
```bash
npx vercel --prod
```

### Vercel build command (configured in Vercel settings)
```
npx convex deploy --cmd 'npm run build'
```
Convex regenerates `_generated/` bindings and deploys functions first, then Next.js builds against the fresh bindings.

### Environment variables

| Variable | Environment | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | Vercel (prod) | Production Convex URL |
| `CONVEX_DEPLOY_KEY` | Vercel (prod) | Convex production deploy key |
| `ANTHROPIC_API_KEY` | Convex (prod + dev) | Anthropic API key |

---

## Testing

All features written test-first (TDD): failing test → minimal implementation → green → commit.

### Unit tests (`tests/unit/`, Vitest + React Testing Library)
- `session.test.ts` — UUID generation, localStorage persistence, validation
- `ingredientParser.test.ts` — comma-separated parsing, trimming, empty filtering
- `imageCompression.test.ts` — Canvas resize, file type validation
- `RecipeCard.test.tsx` — title, time, difficulty, cuisine, link href rendering

### Integration tests (`tests/integration/`, `convex-test` + mocked Anthropic SDK)
- `schema.test.ts` — insert/retrieve recipes and favourites
- `favourites.test.ts` — save, deduplicate, remove, session isolation
- `photos.test.ts` — analyzePhoto returns correct shape, uncertain flag propagation
- `recipes.test.ts` — generateRecipes saves to DB and returns ID, getRecipeSet retrieves correctly

### E2E tests (`tests/e2e/`, Playwright + Chromium)
- `text-input.spec.ts` — button disabled with no input, enabled with input, 3 cards on results page
- `favourites.spec.ts` — save recipe → appears on favourites → remove → empty state

---

## Constraints & Principles

- **YAGNI:** No user accounts, no social features, no recipe ratings, no pagination — none of these until proven necessary
- **3 recipes only:** Always exactly 3 per search — no pagination, no "load more"
- **No image storage:** Photos are processed transiently by Claude and never persisted to the database
- **No login required:** Session scoped to browser localStorage — clearing it resets favourites
- **Beginner-readable code:** Every file section commented to explain what it does and why

---

## Known Limitations

- **Photo upload reliability:** The Claude Vision → ingredient extraction → recipe generation two-step flow occasionally fails silently in production. Root cause not yet investigated. Text input is reliable.
- **Session-scoped favourites:** Clearing localStorage or switching browsers loses saved recipes.
- **No recipe history:** Users cannot browse past searches.
