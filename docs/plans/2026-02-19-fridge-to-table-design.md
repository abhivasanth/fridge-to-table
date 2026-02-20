# Fridge to Table — Design Document

**Date:** 2026-02-19
**Status:** Approved

---

## Overview

A beautifully designed vegetarian recipe suggestion web app. Users input what's in their fridge — by typing ingredients or uploading a photo — and the app suggests 3 personalised vegetarian recipes with everything they need to get cooking immediately.

---

## Architecture & Stack

| Layer | Technology |
|---|---|
| Frontend + Routing | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend / DB | Convex (Actions, Mutations, Queries) |
| AI | Claude API (`claude-sonnet-4-6`) — vision + recipe generation |
| Hosting | Vercel |
| Language | TypeScript throughout |

**Key architectural decisions:**
- All Claude API calls happen inside Convex Actions — server-side only, never in the browser
- Claude API key lives exclusively in Convex environment variables
- Next.js is a pure UI layer using Convex React hooks
- Anonymous session identity: UUID generated on first visit, persisted in `localStorage`
- No user accounts, no login, no server-side sessions

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
// Shared Recipe type (stored as JSON inside recipes.results[])
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
```

**No `sessions` table** — session IDs are just a field on records. No separate entity needed.

---

## Pages & User Flow

### `GET /` — Home
- Hero: app name + tagline
- Input section with tab toggle:
  - **"Type ingredients"** tab: textarea, comma-separated ingredient list
  - **"Upload photo"** tab: drag-and-drop or click-to-upload; image compressed client-side to ≤1024px using Canvas API before sending to Convex
- Optional filters (collapsible panel):
  - Cuisine mood: free-text field (`placeholder="e.g. Italian, spicy, comfort food"`)
  - Max cooking time: 15 / 30 / 45 / 60+ min selector
  - Difficulty: Easy / Medium / Hard toggle
- **[Find Recipes]** CTA — disabled until ≥1 ingredient present
- Loading state: cooking animation while Convex Action runs

### `GET /results/[recipeSetId]` — Results
- 3 recipe cards in responsive grid
- Each card: title, cuisine type, cooking time, difficulty badge, short description
- Click any card → recipe detail page
- Back button → home

### `GET /recipe/[recipeSetId]/[recipeIndex]` — Recipe Detail
- Title + metadata row (time, difficulty, servings)
- Ingredient list: "in your fridge" items shown ticked, missing items highlighted
- Step-by-step numbered instructions
- Shopping list summary section at bottom
- Uncertainty notice banner (if photo analysis flagged uncertain ingredients)
- ♥ Save to Favourites button (toggles saved state)

### `GET /favourites` — Favourites
- Grid of saved recipe cards for this session
- Remove (unfavourite) button on each card
- Empty state: "No favourites yet — start cooking!" with CTA back to home

---

## Claude API Integration

### Step 1 — Photo Analysis (only when photo uploaded)

```
Model: claude-sonnet-4-6
Input: base64-encoded image (compressed ≤1024px client-side before sending)

System: "You are a kitchen assistant analysing fridge photos for a vegetarian recipe app."

User: "Analyse this fridge photo. List every food ingredient you can identify.
Assume all ingredients are vegetarian. If something is ambiguous (e.g. could
be meat broth or vegetable broth), assume vegetarian and include it in
the uncertain list.
Return JSON only, no other text:
{ \"ingredients\": string[], \"uncertain\": string[] }"
```

### Step 2 — Recipe Generation

```
Model: claude-sonnet-4-6
Input: ingredients[], filters

System: "You are a creative vegetarian chef generating recipe suggestions."

User: "The user has these ingredients: [comma-separated list].
Generate exactly 3 vegetarian recipes using mostly these ingredients.
Cuisine style: [cuisine, or 'any style'].
Maximum cooking time: [N] minutes.
Difficulty level: [easy|medium|hard].

For each recipe:
- Mark each ingredient with inFridge: true if the user already has it
- List any additional required ingredients in shoppingList
- If you need to slightly exceed the time or difficulty to give good results, do so
  and note it in the description

Return JSON only, no other text, matching this schema:
[Recipe type schema injected here at runtime]"
```

Both prompts request **JSON-only responses** for deterministic parsing.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Photo too large | Client-side Canvas compression runs before upload — never reaches Convex |
| Photo blurry / unreadable | Claude returns few/no ingredients → toast: "We couldn't read your fridge clearly — try typing your ingredients instead" — text tab pre-selected |
| Zero ingredients | [Find Recipes] button disabled with helper text |
| Claude API failure | Retry button shown: "Our chef is taking a break — try again in a moment" |
| No recipes match strict filters | Claude instructed to relax filters slightly and note it on the recipe card |
| Convex offline | Next.js error boundary with retry — no silent failures |

---

## UI Design Direction

- **Colour palette:** Clean whites, soft greens (`green-50` to `green-600`), warm amber accents for CTAs
- **Typography:** Clean sans-serif (Inter or Geist), large comfortable sizing
- **Cards:** Rounded corners, subtle shadows, food photography placeholder gradients
- **Feel:** Premium consumer app, not a developer demo — every interaction should feel smooth and considered
- **Responsive:** Mobile-first; single column on mobile, grid on tablet/desktop
- **Accessibility:** Sufficient contrast, keyboard navigable, descriptive alt text on all images

---

## Testing Approach (TDD)

All features written test-first: failing test → minimal implementation → green → commit.

### Unit tests (Jest + React Testing Library)
- Image compression utility (Canvas resize → correct output dimensions)
- Ingredient text parser (comma-separated input → clean `string[]`)
- Recipe card component rendering (time, difficulty, title render correctly)
- Favourite add / remove mutations

### Integration tests (Convex test helpers + mocked Claude responses)
- `analyzePhoto` action: mock Claude response → correct `{ ingredients, uncertain }` shape
- `generateRecipes` action: mock Claude response → correct `Recipe[]` shape and count
- `saveFavourite` / `removeFavourite` / `getFavourites` round-trip

### E2E tests (Playwright)
- Text input flow: type ingredients → results page → recipe detail
- Photo upload flow: upload image → results page
- Favourites flow: save recipe → appears on `/favourites` → remove → gone

---

## Constraints & Principles

- **YAGNI:** No user accounts, no social features, no recipe ratings, no pagination — none of these until proven necessary
- **Beginner-readable code:** Every file section commented to explain what it does and why
- **Vegetarian only:** No dietary sub-filters (vegan, gluten-free) in v1
- **3 recipes only:** No pagination, no "load more"
- **No image storage:** Photos are processed transiently by Claude and never persisted
