# Sidebar Navigation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the top navbar links and "My Chefs" home tab with a slide-out sidebar that consolidates all navigation, search history, and quick actions.

**Architecture:** A new `Sidebar` component rendered at the layout level (available on all pages), triggered by a hamburger icon in the existing Navbar. Search history stored in localStorage, ported from the v3 branch.

**Tech Stack:** Next.js 15, React, Tailwind CSS, localStorage

---

## 1. Navbar Changes

- Add a hamburger icon (three horizontal lines) to the **left** of the existing fridge-to-table SVG logo
- **Remove** the "My Chefs" and "Favorites" links from the right side of the navbar
- Hamburger click toggles sidebar open state (managed in `ClientNav`)

## 2. Home Page Tab Changes

- Remove the **"My Chefs" tab** from the pill selector — keep only "Any Recipe" and "Chef's Table"
- Remove all `my-chefs` tab logic and content from `app/page.tsx` (the `customChefs` query, the my-chefs tab rendering, the my-chefs branch in `handleSubmit`)
- The `/my-chefs` management page itself remains, now accessible only via the sidebar

## 3. Sidebar Component

### Layout & Content (top to bottom)

1. **Header row** — "fridge to table" plain text + X close button (top-right)
2. **+ New Search** button — full-width, rust/brown filled (`#C4622A`), navigates to `/`
3. **Search Recipes** — nav link with magnifying glass icon, navigates to `/`
4. **My Chefs** — nav link with chef hat icon, navigates to `/my-chefs`
5. **Favorites** — nav link with heart icon, navigates to `/favourites`
6. **Divider line**
7. **PINNED** section — header (uppercase, gray, pin icon), shows pinned search entries
8. **RECENT SEARCHES** section — header (uppercase, gray, clock icon), flat list of history entries with relative timestamps ("2 hours ago", "Yesterday", "3 days ago")

### Sidebar Behavior

- Width: ~320px, slides in from the left
- Semi-transparent dark backdrop overlay behind it
- **All devices:** hamburger icon opens, X button closes, backdrop click closes
- **Mobile only:** swipe-right-to-dismiss gesture (40% threshold snap, adapted from v3 Sidebar touch logic)
- **Desktop only:** no swipe gesture
- Available on **all pages** via the layout

## 4. Search History

### Data Model

Port `HistoryEntry` type from v3, extended with pin support:

```ts
type HistoryEntry = {
  id: string;
  query: string;              // ingredient string for display
  timestamp: number;
  resultType: "recipes" | "chefs";
  recipeSetId?: string;       // for recipe results
  videoResults?: ChefVideoResult[]; // for chef video results
  pinned?: boolean;           // pinned entries shown in separate section
};
```

### Storage

Port `lib/searchHistory.ts` from v3:
- `loadHistory()` — reads from localStorage
- `saveHistoryEntry(entry)` — prepends entry, caps at 50
- `clearHistory()` — removes all
- Add: `deleteHistoryEntry(id)` — removes a single entry
- Add: `updateHistoryEntry(id, updates)` — for rename and pin/unpin
- Storage key: `ftt_search_history` (not the v3 key, to avoid conflicts)

### Saving Searches

In `app/page.tsx`, after a successful search in `handleSubmit`:
- For "any-recipe" tab: save entry with `resultType: "recipes"` and `recipeSetId`
- For "chefs-table" tab: save entry with `resultType: "chefs"` and `videoResults`

### Clicking a History Entry

- `resultType: "recipes"` — navigate to `/results/{recipeSetId}`
- `resultType: "chefs"` — store videoResults in localStorage, navigate to `/chef-results`

## 5. History Entry Actions

### Desktop

- Each row shows a `...` (three-dot) icon on hover
- Clicking reveals a dropdown menu with: **Rename**, **Pin/Unpin**, **Delete**

### Mobile

- Long-press on a row reveals the same three options as an action sheet or inline row
- Options: **Rename**, **Pin/Unpin**, **Delete**

### Action Details

- **Rename:** Inline edit — query text becomes an editable input, Enter to confirm, Escape/blur to cancel. Updates localStorage via `updateHistoryEntry`.
- **Pin:** Toggles `pinned` boolean. Pinned entries appear in the "PINNED" section above "RECENT SEARCHES". Pin icon used (distinct from heart/favorites for recipes).
- **Delete:** Removes entry from localStorage via `deleteHistoryEntry`. List updates immediately.

## 6. Files to Create/Modify

| File | Action |
|------|--------|
| `types/recipe.ts` | Add `HistoryEntry` type |
| `lib/searchHistory.ts` | New — port from v3 + add delete/update |
| `components/Sidebar.tsx` | New — sidebar drawer component |
| `components/Navbar.tsx` | Modify — add hamburger, remove nav links |
| `components/ClientNav.tsx` | Modify — manage sidebar open state, render Sidebar |
| `app/page.tsx` | Modify — remove my-chefs tab, save search history on submit |
| `app/layout.tsx` | No changes needed (ClientNav already in layout) |

## 7. Out of Scope

- Auth / user profile in sidebar footer
- Search filter input inside the sidebar (just nav links + history list)
- Date grouping (Today/Yesterday) — flat list under "RECENT SEARCHES" with relative timestamps
- Modifications to the v3 branch
