# Recipe Generation Performance Optimization — Design Document

**Date:** 2026-04-16
**Status:** Ready for merge
**Branch:** `feature/sonnet-performance-optimization`

---

## Problem

Recipe generation took ~40 seconds. Users submitted ingredients, saw a loading animation, and waited 40 seconds before seeing results. The bottleneck was Claude Sonnet generating ~3000 tokens for 3 full recipes at ~80-100 tokens/second, plus ~12 seconds of network latency between Convex's action runtime and Anthropic's API.

## Solution

Move the Claude API call from a Convex action to a Next.js API route. The API route connects directly to Anthropic's servers, eliminating the Convex infrastructure latency.

**Result:** ~40s → ~28s (30% improvement).

## Architecture

### Before (production)

```
Browser → useAction(generateRecipes) → Convex Action → messages.create → Convex DB → return
```

- All Claude calls routed through Convex's infrastructure
- Non-streaming (`messages.create`): waits for full response before returning
- ~40 seconds total

### After

```
Browser → fetch(/api/generate-recipes) → Next.js API route → messages.stream → Convex DB → return
```

- Recipe generation calls Anthropic directly from the API route
- Streaming (`messages.stream`): keeps HTTP connection alive during generation
- System message enables Anthropic prompt caching for repeat calls within 5 minutes
- Saves to Convex via `ConvexHttpClient` using a public `saveRecipeSet` mutation
- ~28 seconds total

### What stays in Convex

- Photo analysis (`analyzePhoto` action)
- Chef's Table video search (`searchChefVideos` action)
- All mutations and queries (favourites, pantry, shopping list, custom chefs)
- The original `generateRecipes` action (kept as production-identical fallback)

## Decisions and rationale

### Why not parallel calls with a faster model?

We tested Haiku 4.5 for recipe detail generation (Sonnet for titles, Haiku for ingredients/steps). Total time dropped to ~8 seconds, but Haiku lacked regional cuisine knowledge — e.g., suggesting rotis with South Indian dishes. The quality difference was unacceptable. Sonnet's cultural and regional nuance is core to the product experience.

### Why not parallel Sonnet calls?

We tested 3 parallel Sonnet calls (one per recipe). Anthropic's rate limit on concurrent Sonnet requests throttled them to semi-sequential execution. Total time was ~25 seconds — barely better than the single call and with recipe diversity issues since each call was independent.

### Why a Next.js API route instead of a Convex action?

Convex actions route through Convex's infrastructure, adding ~12 seconds of network latency to the Anthropic API call. The API route connects directly, reducing total time from ~40s to ~28s. The tradeoff is a public mutation (`saveRecipeSet`) and `ANTHROPIC_API_KEY` in Vercel environment variables.

### Why `maxDuration = 60`?

Vercel's default serverless function timeout on the Hobby plan is 10 seconds. Recipe generation takes ~28 seconds. `maxDuration = 60` raises the limit to 60 seconds, providing ~32 seconds of headroom.

### Why keep the Convex action as a fallback?

The `generateRecipes` action is byte-identical to production. If the API route has issues in production, reverting to the Convex action is a one-line change in `HomePage.tsx` — swap `fetch` back to `useAction`. No backend changes needed.

### Why a separate `saveRecipeSet` mutation?

`ConvexHttpClient` (used by the API route) can only call public mutations. The existing `insertRecipeSet` is `internalMutation` (server-side only). Rather than making `insertRecipeSet` public and exposing the internal mutation used by Convex actions, we created a separate public mutation with the same handler. When auth is added, `saveRecipeSet` gets an identity check — same pattern as the 8 other public mutations in the app.

### Why a system message for the persona?

Production embeds "You are a creative chef generating recipe suggestions" in the user message. The API route moves it to a `system` parameter. This is Anthropic's recommended practice and enables prompt caching — the system prompt is cached after the first call, reducing input processing time for subsequent calls within 5 minutes.

## Files changed

| File | Change |
|------|--------|
| `app/api/generate-recipes/route.ts` | **New** — streaming Claude call, `maxDuration = 60`, full try/catch |
| `convex/recipes.ts` | Added `saveRecipeSet` public mutation (+17 lines). `generateRecipes` action unchanged. |
| `components/HomePage.tsx` | Recipe branch: `useAction` → `fetch`. Removed unused binding. (+8/-6 lines) |
| `tests/integration/recipes.test.ts` | 4 new tests for `saveRecipeSet` |

## Production deployment

1. Add `ANTHROPIC_API_KEY` to Vercel environment variables (same key as Convex env)
2. Deploy via `npx vercel --prod`

## Alternatives considered but not pursued

| Alternative | Why not |
|-------------|---------|
| Haiku for recipe details | Lacked regional cuisine knowledge (roti in Chennai dishes) |
| Parallel Sonnet calls | Rate-limited to ~25s, recipe diversity issues |
| SSE streaming with progress UI | Unnecessary complexity for 28s wait; LoadingChef animation sufficient |
| Convex real-time progress tracking | Added a table, 5 mutations, cleanup logic — all unnecessary for the final architecture |
| Pre-generated recipe cache | Good future optimization but separate scope |
| Fine-tuned cooking model (distillation) | Significant project — dataset generation, training, evaluation |
