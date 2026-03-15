# Pantry & Shopping List Design

**Date:** 2026-03-15
**Status:** Implemented

## Goal

Add persistent My Pantry and My Shopping List features, plus pantry-aware recipe pages that hide pantry items from the shopping list card and highlight them in the ingredients list.

## Architecture

Three interconnected features sharing a common normalization layer:

1. **My Pantry page** (`/my-pantry`) — categorized pill-based UI for managing staple ingredients
2. **My Shopping List page** (`/my-shopping-list`) — flat list of items to buy, addable from recipes or manually
3. **Recipe page integration** — ingredients list shows pantry items with green dot; shopping list card hides pantry items entirely

### Name Normalization Pipeline

All pantry and shopping list operations normalize ingredient names:
- Lowercase and trim
- Strip qualifiers: fresh, dried, ground, whole, frozen, canned, organic, raw, cooked, chopped, sliced, minced, grated, crushed, roasted, toasted, unsalted, salted, extra-virgin, light, dark
- Resolve aliases: chilli → chili, capsicum → bell pepper, coriander → cilantro, aubergine → eggplant, courgette → zucchini, etc.
- Depluralize: potatoes → potato, tomatoes → tomato, berries → berry, leaves → leaf, etc.

### Auto-Classification (Pantry Only)

Items are classified server-side into categories:
- **Oils & Fats** — olive oil, butter, ghee, coconut oil, etc.
- **Spices & Powders** — cumin, turmeric, paprika, etc.
- **Sauces & Condiments** — soy sauce, ketchup, mustard, etc.
- **Basics** — salt, sugar, flour, rice, etc.
- **Other** — everything else

### Compound Ingredient Handling

Recipe ingredients like "to taste salt and pepper" are:
1. Stripped of quantity/unit prefixes ("to taste salt and pepper" → "salt and pepper")
2. Split on " and " → ["salt", "pepper"]
3. Each part normalized and matched individually against pantry/shopping list

### Data Flow

```
Recipe Page (Server Component)
  └─ RecipeIngredientsList (Client) ←── useQuery(pantryItems)
  └─ RecipeShoppingCard (Client) ←── useQuery(pantryItems) + useQuery(shoppingListItems)
       ├─ + button → addToShoppingList mutation
       ├─ ✓ button → removeFromShoppingList mutation
       └─ "already have it" → addToPantry mutation (item disappears from card)

My Pantry Page (Client)
  └─ useQuery(pantryItems) + addToPantry/removeFromPantry mutations

My Shopping List Page (Client)
  └─ useQuery(shoppingListItems) + addToShoppingList/removeFromShoppingList mutations
```

## Design Decisions

- **Convex isolation constraint:** Normalization logic is duplicated in `lib/pantryUtils.ts` (client) and `convex/pantry.ts` / `convex/shoppingList.ts` (backend). Convex runtime cannot import from Next.js `lib/`.
- **Batch query + client-side Set lookup:** Fetch all pantry/shopping items per session, build `Set<string>` on client for O(1) lookups. Avoids per-ingredient queries.
- **Optimistic UI:** `RecipeShoppingCard` uses a `Map<string, OptimisticState>` for instant feedback before Convex confirms mutations.
- **Pantry items hidden (not strikethrough):** Originally designed as strikethrough in the shopping list card, but user feedback was clear: if it's in the pantry, don't show it at all. The entire card hides when all items are in pantry.
- **Undo toast (pantry only):** Removing a pantry item shows a 3-second undo toast. Shopping list uses a simpler fade-out animation.
- **Dedup feedback:** Both pages show "already in your list/pantry" with a highlight on the existing item when a duplicate is attempted.

## Files Created

| File | Purpose |
|---|---|
| `lib/pantryUtils.ts` | Name normalization, alias resolution, category classification |
| `lib/ingredientNameParser.ts` | Strip quantity/unit prefixes, split compound ingredients |
| `convex/pantry.ts` | Pantry CRUD mutations + query (duplicated normalization) |
| `convex/shoppingList.ts` | Shopping list CRUD mutations + query (duplicated normalization) |
| `components/PantryPage.tsx` | My Pantry client component |
| `components/ShoppingListPage.tsx` | My Shopping List client component |
| `components/RecipeIngredientsList.tsx` | Pantry-aware ingredients list |
| `components/RecipeShoppingCard.tsx` | Interactive shopping list card |
| `app/my-pantry/page.tsx` | Route wrapper |
| `app/my-shopping-list/page.tsx` | Route wrapper |
| `tests/unit/pantryUtils.test.ts` | 34 tests for normalization + classification |
| `tests/unit/ingredientNameParser.test.ts` | 23 tests for name parsing + compound splitting |

## Files Modified

| File | Change |
|---|---|
| `convex/schema.ts` | Added `pantryItems` and `shoppingListItems` tables |
| `components/Sidebar.tsx` | Added My Pantry and My Shopping List nav items |
| `components/ClientNav.tsx` | Added pantry and cart icon rail buttons |
| `app/recipe/[recipeSetId]/[recipeIndex]/page.tsx` | Replaced inline ingredients/shopping list with new client components |
