# Search State Persistence on Back Navigation — Design

## Goal

When users hit back from results/recipe pages, the home page restores their ingredients, tab, filters, diet, and chef selections — so they can tweak and re-search without starting over. Fresh app opens always show a clean page.

## Current State

- All home page state (tab, ingredients, filters, diet) is in-memory React state
- Navigating away and back remounts the component, losing everything
- Chef selection is already persisted in `localStorage` (unrelated to this feature)

## Design

### What Gets Saved

| State | Storage | When saved |
|---|---|---|
| Active tab | `sessionStorage` | On tab switch |
| Ingredient text | `sessionStorage` | On submit |
| Filters (cuisine, time, difficulty) | `sessionStorage` | On submit |
| Diet preference | `sessionStorage` | On submit |
| Selected chef IDs | `localStorage` (existing) | Already handled |

### Storage Key

Single key `fridgeToTable_searchState` in `sessionStorage` holding a JSON object:

```json
{
  "activeTab": "any-recipe",
  "ingredientText": "chicken, rice, garlic",
  "filters": { "cuisine": "Italian", "maxCookingTime": 30, "difficulty": "easy" },
  "diet": "vegetarian"
}
```

### When State is Saved

- **Active tab:** saved immediately on tab switch (lightweight)
- **Everything else:** saved on submit, just before navigation to results

### When State is Restored

On `HomePage` mount, read `sessionStorage`. If found:
- Set `activeTab`, `filters`, `diet` from saved values
- Pass saved ingredient text as `initialText` prop to `IngredientInput`

### When State is Cleared

- **"New Search" button (sidebar):** clear `sessionStorage` before navigating to `/`
- **Tab/browser close:** `sessionStorage` clears automatically
- **Fresh app open:** no `sessionStorage` exists = clean page

### Component Changes

- `IngredientInput` gets one new optional prop: `initialText?: string`
- `IngredientInput` diet state needs to accept an `initialDiet` prop or be lifted to parent
- Sidebar "New Search" button clears the `sessionStorage` key before navigating

### What Doesn't Change

- No changes to routing, results pages, or backend
- No changes to `localStorage`-based chef slot persistence
- Photo preview is not restored (ingredients text is sufficient)
- Scroll position is not restored (always scroll to top)

### Edge Cases

- **Multiple searches:** each submit overwrites `sessionStorage`, only latest search restores
- **Browser back vs in-app back:** both trigger `HomePage` mount, both restore from `sessionStorage` — identical behavior
- **Chef's Table tab + My Chefs changes:** no conflict — `localStorage` is source of truth for chef IDs, `sessionStorage` only stores the active tab
