# My Chefs — Design Document

**Date:** 2026-02-26
**Status:** Approved

---

## Problem

Users of the Chef's Table feature are seeing videos from chefs they didn't intentionally choose, or getting results that are too complex for their skill level. The current hardcoded list of 8 celebrity chefs offers no personalisation — every user sees the same grid, and chef selections reset on every visit.

The specific trigger: a user received a Gordon Ramsay video for a simple ingredient search. His channel skews toward elaborate techniques. The user had no way to prevent this or replace him with a creator whose style better matched their cooking level.

---

## Goal

Let users build and persist a personal list of up to 6 YouTube cooking creators. Their custom list powers a "My Chefs" search mode on the home page — identical in behaviour to the existing Chef's Table, but drawing from their own curated channels instead of the hardcoded 8.

The existing Chef's Table remains unchanged.

---

## Non-Goals

- User accounts / authentication — not in scope. Anonymous `sessionId` is sufficient.
- Cross-device sync — data is tied to the browser session (same behaviour as Favourites today).
- Editing or reordering saved chefs beyond add/remove.
- Searching multiple channels simultaneously with deduplication.
- Any changes to the "Any Recipe" or existing "Chef's Table" tabs.

---

## Architecture

### Overview

```
User pastes YouTube URL
        ↓
resolveYouTubeChannel (Convex action)
  — parses handle / channel ID from URL
  — calls YouTube Data API v3 channels endpoint
  — returns { channelId, channelName, channelThumbnail }
        ↓
Preview card shown → user confirms
        ↓
addCustomChef (Convex mutation)
  — upserts customChefsList document for sessionId
  — enforces 6-chef limit + duplicate check
        ↓
/my-chefs page reflects updated list
        ↓
User goes to home page → My Chefs tab
  — reads customChefsList via listCustomChefs query
  — enters ingredients → search
        ↓
searchChefVideos (existing Convex action — no changes)
        ↓
/chef-results (existing page — no changes)
```

### Tech stack

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS
- **Backend:** Convex (mutations, queries, actions)
- **External API:** YouTube Data API v3 (server-side only, existing API key)

---

## Data Model

### New table: `customChefsList`

One document per session. The `chefs` array holds up to 6 entries.

```typescript
customChefsList: defineTable({
  sessionId:  v.string(),
  chefs: v.array(v.object({
    channelId:        v.string(),   // YouTube channel ID (UCxxxxxx)
    channelName:      v.string(),   // Display name from YouTube API
    channelThumbnail: v.string(),   // Channel avatar URL (stable CDN URL)
    addedAt:          v.number(),   // Date.now() — used for display ordering
    resolvedAt:       v.number(),   // When we last fetched from YouTube API
  })),
  updatedAt: v.number(),            // Last mutation timestamp
}).index("by_session", ["sessionId"]),
```

**Design rationale:**
- Single document per session (not one row per chef) — the entire list is always read and written as a unit. Atomic writes, no race conditions on the 6-limit check, no compound indexes needed.
- `resolvedAt` per chef enables optional stale-data refresh in future (e.g. re-resolve if > 30 days old).
- `updatedAt` at document level for observability.
- 6-chef limit enforced in the mutation (Convex has no native constraint). Duplicate `channelId` also checked in the mutation.

---

## Convex Functions

### `resolveYouTubeChannel` (action)

Accepts a raw string (URL or bare handle). Returns channel metadata or an error.

**Input:**
```typescript
{ input: string }  // e.g. "https://youtube.com/@babish" or "@babish"
```

**URL formats handled:**
| Input format | Parse strategy |
|---|---|
| `youtube.com/@handle` | Extract handle → `forHandle=handle` API call |
| `@handle` (bare) | Strip `@` → `forHandle=handle` API call |
| `youtube.com/channel/UCxxxxxx` | Extract channel ID → `id=UCxxxxxx` API call |
| `youtube.com/c/VanityName` | Not supported — return parse error |
| Unrecognised | Return parse error |

**Output (success):**
```typescript
{ ok: true, channelId: string, channelName: string, channelThumbnail: string, resolvedAt: number }
```

**Output (error):**
```typescript
{ ok: false, error: "not_found" | "parse_error" | "api_error" }
```

YouTube API call: `GET /youtube/v3/channels?part=snippet&forHandle={handle}&key={key}`

---

### `addCustomChef` (mutation)

Upserts the `customChefsList` document for the session. Enforces constraints before writing.

**Input:**
```typescript
{
  sessionId:        string,
  channelId:        string,
  channelName:      string,
  channelThumbnail: string,
  resolvedAt:       number,
}
```

**Logic:**
1. Query `customChefsList` by `sessionId`
2. If document exists:
   - Reject if `chefs.length >= 6` → throw "limit_reached"
   - Reject if `chefs.some(c => c.channelId === channelId)` → throw "duplicate"
   - Patch: append new chef to `chefs`, update `updatedAt`
3. If no document: insert new document with one-item `chefs` array

---

### `removeCustomChef` (mutation)

Removes a single chef from the array by `channelId`.

**Input:**
```typescript
{ sessionId: string, channelId: string }
```

**Logic:** Query document → filter out the matching channelId → patch `chefs` + `updatedAt`.

---

### `listCustomChefs` (query)

Returns the full chef list for a session. Used by both the `/my-chefs` page and the home page "My Chefs" tab.

**Input:** `{ sessionId: string }`

**Output:** `Chef[]` (the `chefs` array), sorted by `addedAt` ascending. Returns `[]` if no document exists.

---

## Pages & Components

### New page: `/my-chefs`

**Route:** `app/my-chefs/page.tsx`

**Responsibilities:**
- Display saved custom chefs (thumbnail + name + remove button)
- URL input field for adding new chefs
- Resolve → preview → confirm flow

**States:**

| State | UI |
|---|---|
| Loading | Spinner |
| Empty list | "Add your first chef below" prompt, input visible |
| 1–5 chefs | Chef list + input visible |
| 6 chefs (limit) | Chef list + input hidden + "Remove a chef to add another" message |

**Add chef flow:**
1. User pastes URL into input → `resolveYouTubeChannel` called on paste/blur
2. Preview card appears: channel thumbnail + name + "Add" button
3. User clicks "Add" → `addCustomChef` called → list updates reactively
4. Preview card clears, input resets

**Inline error messages (shown below input):**
- Parse error → "Paste a YouTube channel URL or @handle"
- Not found → "We couldn't find that channel — check the URL"
- Duplicate → "That chef is already in your list"
- API error → "Something went wrong — try again"
- Limit reached → (input hidden, message shown instead)

---

### Updated: Home page (`app/page.tsx`)

Add `"my-chefs"` to the `ActiveTab` union type.

**3rd tab — empty state (no custom chefs):**
```
👨‍🍳
You haven't added any chefs yet
→ Set up My Chefs          (link to /my-chefs)
```
Ingredient input and search button hidden.

**3rd tab — chefs saved:**
- Read-only list of saved chefs (thumbnail + name)
- "Edit list →" link to `/my-chefs`
- Ingredient input + search button shown
- On submit: calls `searchChefVideos` with custom chefs → navigates to `/chef-results`

---

### New component: `CustomChefCard`

Reusable card for displaying a resolved/saved chef:

```typescript
type Props = {
  chef: { channelId: string, channelName: string, channelThumbnail: string },
  onRemove?: () => void,   // undefined = read-only (home tab view)
  isPreview?: boolean,     // true = show "Add" button instead of remove
  onAdd?: () => void,
}
```

---

### Updated: `Navbar`

Add "My Chefs" link between logo and Favourites:

```
[fridge to table]      [My Chefs]  [Favourites]
```

Active state (pill highlight) when `pathname === "/my-chefs"`. Same style as existing Favourites link.

---

## Search Flow (My Chefs tab → results)

1. User enters ingredients on "My Chefs" tab
2. App calls `listCustomChefs` (already loaded via `useQuery`) to get the chef array
3. Calls existing `searchChefVideos` action — same signature, no changes needed
4. Stores results in `localStorage` as `"chefTableResults"` (same key as Chef's Table)
5. Navigates to `/chef-results` — existing page, no changes

**Zero backend changes** to the search/results path.

---

## Edge Cases

| Scenario | Handling |
|---|---|
| Invalid / unrecognised URL format | Parse error shown inline |
| Channel not found (404 from YouTube API) | "not_found" error shown inline |
| Duplicate channel added | "duplicate" error shown inline |
| 6-chef limit reached | Add input hidden, limit message shown |
| YouTube API key missing | Graceful degradation — same as existing `chefs.ts` |
| YouTube API quota exceeded | `api_error` shown inline |
| `customChefsList` document missing | `listCustomChefs` returns `[]`; home tab shows empty state |
| User clears localStorage | New `sessionId` generated; custom chefs list not recoverable (same as Favourites) |

---

## File Inventory

### New files
| File | Purpose |
|---|---|
| `convex/customChefs.ts` | All 4 Convex functions |
| `app/my-chefs/page.tsx` | Management page |
| `components/CustomChefCard.tsx` | Reusable chef card (preview + saved states) |

### Modified files
| File | Change |
|---|---|
| `convex/schema.ts` | Add `customChefsList` table |
| `app/page.tsx` | Add "My Chefs" 3rd tab |
| `components/Navbar.tsx` | Add "My Chefs" nav link |

### Unchanged files
| File | Reason |
|---|---|
| `convex/chefs.ts` | `searchChefVideos` already accepts any chef array |
| `app/chef-results/page.tsx` | Results page reused as-is |
| `components/ChefGrid.tsx` | Chef's Table tab unchanged |
| `lib/chefs.ts` | Hardcoded chefs unchanged |

---

## Testing Plan

### Unit tests
- `resolveYouTubeChannel`: each URL format → correct parse + API call
- `resolveYouTubeChannel`: not found, API error → correct error shape returned
- `addCustomChef`: happy path, limit_reached, duplicate
- `removeCustomChef`: removes correct chef, no-op if not found
- `listCustomChefs`: returns sorted list, empty array when no document

### Integration tests
- Add chef end-to-end: paste URL → preview → confirm → appears in list
- Remove chef: remove button → disappears from list
- Limit enforcement: add 6 chefs → input disappears
- Home page My Chefs tab: empty state → link to /my-chefs; with chefs → search navigates to /chef-results

### E2E (Playwright)
- Full add-chef flow on `/my-chefs`
- My Chefs search → `/chef-results` with custom chefs
- Persistence: add chefs, reload page, chefs still present
