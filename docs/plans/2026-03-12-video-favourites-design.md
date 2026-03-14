# Video Favourites — Design Document

**Date:** 2026-03-12
**Goal:** Allow users to save YouTube chef videos as favourites, alongside the existing recipe favourites system.

---

## Architecture Decisions

| Decision | Resolution |
|----------|-----------|
| Save action UI | Heart on `ChefVideoCard` (thumbnail overlay) + `VideoModal` (inline in info bar) |
| Favourites page | Same `/favourites` page, two sections — "Saved Recipes" then "Saved Videos" |
| Storage | Convex `videoFavourites` table, session-based (same pattern as recipe favourites) |
| Component pattern | Self-contained `VideoFavouriteButton` with `size="sm"\|"md"` prop |
| Type changes | `ChefVideoResult.channelId: string` required; runtime fallback for stale localStorage |

---

## Data Layer

### New Convex table: `videoFavourites`

| Field | Type | Notes |
|-------|------|-------|
| `sessionId` | string | Anonymous user UUID from localStorage |
| `videoId` | string | YouTube video ID |
| `title` | string | Video title |
| `thumbnail` | string | YouTube thumbnail URL |
| `channelId` | string | YouTube channel ID |
| `channelName` | string | Denormalized for display |
| `savedAt` | number | `Date.now()` timestamp |

**Indexes:**
- `by_session` on `[sessionId]` — load all video favourites for the page
- `by_session_and_video` on `[sessionId, videoId]` — idempotent save/remove

### New Convex file: `convex/videoFavourites.ts`

Three functions mirroring `convex/favourites.ts`:
- `saveVideoFavourite` — mutation, inserts if not already saved (idempotent)
- `removeVideoFavourite` — mutation, deletes by sessionId + videoId
- `getVideoFavourites` — query, returns all for session, descending by savedAt

---

## New Component: `VideoFavouriteButton`

**File:** `components/VideoFavouriteButton.tsx`

Self-contained component that owns its own Convex query/mutation. Mirrors the existing `FavouriteButton` pattern.

**Props:**
- `videoId: string`
- `title: string`
- `thumbnail: string`
- `channelId: string`
- `channelName: string`
- `size: "sm" | "md"` (required)

**Sizes:**
- `sm` — icon-only circle, positioned as thumbnail overlay on `ChefVideoCard`
- `md` — icon + text, inline in `VideoModal` info bar alongside "Copy link" / "Watch on YouTube"

**Behavior:**
- Queries `videoFavourites.getVideoFavourites` for session, checks if `videoId` is saved
- Toggle calls save or remove mutation
- Heart icon: filled red when saved, outline when not
- `sm` variant uses `stopPropagation` to prevent triggering card's `onPlay`

---

## UI Integration

### `ChefVideoCard`
- Add `VideoFavouriteButton size="sm"` positioned `absolute top-2 right-2 z-10` inside the thumbnail container
- Thread `channelId` from `ChefVideoResult` (new field)

### `VideoModal`
- Add `VideoFavouriteButton size="md"` in the info bar action row
- Thread `channelId` and `channelName` from parent

### `/favourites` page
- Add `VideoFavouritesGrid` component below existing `FavouritesGrid`
- Each card shows thumbnail, title, channel name, remove button, and YouTube link
- Empty state: section hidden entirely if no saved videos (no separate empty message)

---

## Type Changes

### `types/recipe.ts`
- Add `channelId: string` to `ChefVideoResult` (required)

### `convex/chefs.ts`
- Add `channelId: chef.youtubeChannelId` to all return objects in `searchChefVideos`

### `ChefResultsPage`
- Runtime guard when parsing localStorage: fall back to `chefId` if `channelId` missing on stale data

---

## Schema Change: `convex/schema.ts`

Add `videoFavourites` table definition alongside existing `favourites` table.

---

## Non-goals
- No in-page video modal on the favourites page (just link to YouTube)
- No cross-session persistence (session-scoped like recipe favourites)
- No emoji storage in videoFavourites (resolve at render time from chef config)
