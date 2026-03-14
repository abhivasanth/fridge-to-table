# Video Favourites Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to save YouTube chef videos as favourites, with a heart button on video cards and in the video modal, and a "Saved Videos" section on the existing favourites page.

**Architecture:** New `videoFavourites` Convex table with session-based storage. Self-contained `VideoFavouriteButton` component (two sizes). `channelId` threaded from YouTube API through to the frontend. Favourites page extended with a second section.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS, Convex

---

### Task 1: Add `channelId` to `ChefVideoResult` type and `searchChefVideos` action

**Files:**
- Modify: `types/recipe.ts:28-38`
- Modify: `convex/chefs.ts:25-75`

**Step 1: Update the `ChefVideoResult` type**

In `types/recipe.ts`, add `channelId: string` to `ChefVideoResult`:

```ts
export type ChefVideoResult = {
  chefId: string;
  chefName: string;
  chefEmoji: string;
  channelId: string;
  found: boolean;
  video?: {
    title: string;
    thumbnail: string;
    videoId: string;
  };
};
```

**Step 2: Add `channelId` to all return objects in `convex/chefs.ts`**

Add `channelId: chef.youtubeChannelId` to every return object in `searchChefVideos`:

- Line 26 (no API key fallback): add `channelId: chef.youtubeChannelId,`
- Line 54 (API error): add `channelId: chef.youtubeChannelId,`
- Line 59 (no item): add `channelId: chef.youtubeChannelId,`
- Line 63 (success): add `channelId: chef.youtubeChannelId,`
- Line 75 (catch): add `channelId: chef.youtubeChannelId,`

**Step 3: Add runtime fallback in `app/chef-results/page.tsx`**

After parsing localStorage on line 18, add a fallback for stale data:

```ts
const parsed: ChefVideoResult[] = JSON.parse(stored);
// Backfill channelId for stale localStorage entries
setResults(parsed.map((r) => ({
  ...r,
  channelId: r.channelId || r.chefId,
})));
```

Replace the existing `setResults(JSON.parse(stored));` on line 18.

**Step 4: Verify build passes**

Run: `npm run build`
Expected: Successful build, no type errors

**Step 5: Commit**

```bash
git add types/recipe.ts convex/chefs.ts app/chef-results/page.tsx
git commit -m "feat: add channelId to ChefVideoResult type and searchChefVideos action"
```

---

### Task 2: Add `videoFavourites` table to Convex schema

**Files:**
- Modify: `convex/schema.ts:1-52`

**Step 1: Add the `videoFavourites` table definition**

After the `customChefs` table (line 51), add:

```ts
  videoFavourites: defineTable({
    sessionId: v.string(),
    videoId: v.string(),
    title: v.string(),
    thumbnail: v.string(),
    channelId: v.string(),
    channelName: v.string(),
    savedAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_video", ["sessionId", "videoId"]),
```

Update the file comment on line 5 to:
```ts
// Three main tables: recipes, favourites, and videoFavourites. Plus customChefs.
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Successful build (Convex will generate updated types)

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add videoFavourites table to Convex schema"
```

---

### Task 3: Create `convex/videoFavourites.ts` — Convex mutations and query

**Files:**
- Create: `convex/videoFavourites.ts`

**Step 1: Create the file with all three functions**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Saves a video to the user's favourites list.
// Silently ignores duplicate saves (idempotent).
export const saveVideoFavourite = mutation({
  args: {
    sessionId: v.string(),
    videoId: v.string(),
    title: v.string(),
    thumbnail: v.string(),
    channelId: v.string(),
    channelName: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoFavourites")
      .withIndex("by_session_and_video", (q) =>
        q.eq("sessionId", args.sessionId).eq("videoId", args.videoId)
      )
      .first();

    if (!existing) {
      await ctx.db.insert("videoFavourites", {
        sessionId: args.sessionId,
        videoId: args.videoId,
        title: args.title,
        thumbnail: args.thumbnail,
        channelId: args.channelId,
        channelName: args.channelName,
        savedAt: Date.now(),
      });
    }
  },
});

// Removes a video from the user's favourites list.
// Silently ignores if the entry doesn't exist.
export const removeVideoFavourite = mutation({
  args: {
    sessionId: v.string(),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("videoFavourites")
      .withIndex("by_session_and_video", (q) =>
        q.eq("sessionId", args.sessionId).eq("videoId", args.videoId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Returns all video favourites for a session, sorted most-recently-saved first.
export const getVideoFavourites = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("videoFavourites")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();
  },
});
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 3: Commit**

```bash
git add convex/videoFavourites.ts
git commit -m "feat: add videoFavourites Convex mutations and query"
```

---

### Task 4: Create `VideoFavouriteButton` component

**Files:**
- Create: `components/VideoFavouriteButton.tsx`

**Step 1: Create the component**

```tsx
"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";

type Props = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  size: "sm" | "md";
};

// Heart button that toggles a video's saved state.
// size="sm": icon-only overlay circle for ChefVideoCard thumbnails.
// size="md": icon + text inline button for VideoModal info bar.
export function VideoFavouriteButton({
  videoId,
  title,
  thumbnail,
  channelId,
  channelName,
  size,
}: Props) {
  const sessionId = getSessionId();
  const videoFavourites = useQuery(
    api.videoFavourites.getVideoFavourites,
    sessionId ? { sessionId } : "skip"
  );
  const saveVideoFavourite = useMutation(api.videoFavourites.saveVideoFavourite);
  const removeVideoFavourite = useMutation(api.videoFavourites.removeVideoFavourite);

  const isFavourited = videoFavourites?.some((f) => f.videoId === videoId);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isFavourited) {
      await removeVideoFavourite({ sessionId, videoId });
    } else {
      await saveVideoFavourite({
        sessionId,
        videoId,
        title,
        thumbnail,
        channelId,
        channelName,
      });
    }
  }

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isFavourited ? "Remove video from favourites" : "Save video to favourites"}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
          ${isFavourited
            ? "bg-red-500 text-white"
            : "bg-black/40 text-white hover:bg-black/60"
          }`}
      >
        <span className="text-sm">{isFavourited ? "♥" : "♡"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFavourited ? "Remove video from favourites" : "Save video to favourites"}
      className={`flex items-center gap-1 text-xs transition-colors
        ${isFavourited
          ? "text-red-500 hover:text-red-600"
          : "text-gray-400 hover:text-gray-600"
        }`}
    >
      <span className="text-sm">{isFavourited ? "♥" : "♡"}</span>
      {isFavourited ? "Saved" : "Save"}
    </button>
  );
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 3: Commit**

```bash
git add components/VideoFavouriteButton.tsx
git commit -m "feat: add VideoFavouriteButton component with sm/md sizes"
```

---

### Task 5: Add heart overlay to `ChefVideoCard`

**Files:**
- Modify: `components/ChefVideoCard.tsx:22-46`

**Step 1: Add import**

Add at top of file:
```tsx
import { VideoFavouriteButton } from "@/components/VideoFavouriteButton";
```

**Step 2: Add heart button inside the thumbnail `<div className="relative">` block**

After the play icon overlay div (after line 45), before the closing `</div>` of the relative container, add:

```tsx
        {/* Favourite heart overlay */}
        <div className="absolute top-2 right-2 z-10">
          <VideoFavouriteButton
            videoId={result.video.videoId}
            title={result.video.title}
            thumbnail={result.video.thumbnail}
            channelId={result.channelId}
            channelName={result.chefName}
            size="sm"
          />
        </div>
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 4: Commit**

```bash
git add components/ChefVideoCard.tsx
git commit -m "feat: add favourite heart overlay to ChefVideoCard"
```

---

### Task 6: Add save button to `VideoModal`

**Files:**
- Modify: `components/VideoModal.tsx:1-160`

**Step 1: Add new props to the VideoModal type**

Update the Props type to include `channelId` and `channelName`:

```ts
type Props = {
  videoId: string;
  title: string;
  chefName: string;
  chefEmoji: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  onClose: () => void;
};
```

Update the destructured params:
```ts
export function VideoModal({ videoId, title, chefName, chefEmoji, thumbnail, channelId, channelName, onClose }: Props) {
```

**Step 2: Add import**

Add at top of file:
```tsx
import { VideoFavouriteButton } from "@/components/VideoFavouriteButton";
```

**Step 3: Add the save button in the info bar actions row**

In the `<div className="flex items-center gap-3">` (line 122), add before the copy-link button:

```tsx
              <VideoFavouriteButton
                videoId={videoId}
                title={title}
                thumbnail={thumbnail}
                channelId={channelId}
                channelName={channelName}
                size="md"
              />
```

**Step 4: Update `ChefResultsPage` to pass new props to `VideoModal`**

In `app/chef-results/page.tsx`, update the `<VideoModal>` call (around line 74) to include the new props:

```tsx
        <VideoModal
          videoId={activeVideo.video.videoId}
          title={activeVideo.video.title}
          chefName={activeVideo.chefName}
          chefEmoji={activeVideo.chefEmoji}
          thumbnail={activeVideo.video.thumbnail}
          channelId={activeVideo.channelId}
          channelName={activeVideo.chefName}
          onClose={() => setActiveVideo(null)}
        />
```

**Step 5: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 6: Commit**

```bash
git add components/VideoModal.tsx app/chef-results/page.tsx
git commit -m "feat: add favourite save button to VideoModal info bar"
```

---

### Task 7: Create `VideoFavouritesGrid` component

**Files:**
- Create: `components/VideoFavouritesGrid.tsx`

**Step 1: Create the component**

```tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";

// Renders the user's saved video favourites.
// Hidden entirely if empty (no separate empty state — recipe section handles it).
export function VideoFavouritesGrid() {
  const sessionId = getSessionId();
  const videoFavourites = useQuery(
    api.videoFavourites.getVideoFavourites,
    sessionId ? { sessionId } : "skip"
  );
  const removeVideoFavourite = useMutation(api.videoFavourites.removeVideoFavourite);

  if (!videoFavourites || videoFavourites.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-[#1A3A2A] mb-4">Saved Videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videoFavourites.map((fav) => (
          <div
            key={fav._id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative"
          >
            {/* Remove button */}
            <button
              onClick={() => removeVideoFavourite({ sessionId, videoId: fav.videoId })}
              aria-label="Remove from favourites"
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <span className="text-sm">♥</span>
            </button>

            {/* Thumbnail linking to YouTube */}
            <a
              href={`https://www.youtube.com/watch?v=${fav.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fav.thumbnail}
                alt={fav.title}
                className="w-full aspect-video object-cover"
              />
              <div className="p-4">
                <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{fav.title}</p>
                <p className="text-xs text-[#D4622A] font-medium mt-2">{fav.channelName}</p>
                <p className="text-xs text-gray-400 mt-1">Watch on YouTube ↗</p>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 3: Commit**

```bash
git add components/VideoFavouritesGrid.tsx
git commit -m "feat: add VideoFavouritesGrid component for favourites page"
```

---

### Task 8: Integrate `VideoFavouritesGrid` into favourites page

**Files:**
- Modify: `app/favourites/page.tsx:1-25`

**Step 1: Convert to client component and add imports**

The page needs `"use client"` because `VideoFavouritesGrid` uses Convex hooks. Add at top:

```tsx
"use client";
import { FavouritesGrid } from "@/components/FavouritesGrid";
import { VideoFavouritesGrid } from "@/components/VideoFavouritesGrid";
import Link from "next/link";
```

**Step 2: Update page subtitle and add `VideoFavouritesGrid`**

Change the subtitle from "Recipes you've saved this session" to "Your saved recipes and videos".

Add `<VideoFavouritesGrid />` after `<FavouritesGrid />`:

```tsx
        <FavouritesGrid />
        <VideoFavouritesGrid />
```

**Step 3: Verify build passes**

Run: `npm run build`
Expected: Successful build

**Step 4: Commit**

```bash
git add app/favourites/page.tsx
git commit -m "feat: add saved videos section to favourites page"
```

---

### Task 9: Final build verification and cleanup

**Step 1: Full build**

Run: `npm run build`
Expected: Successful build with no errors or warnings

**Step 2: Manual test checklist**

On localhost:
- [ ] Search with Chef's Table, see video results with heart overlays on cards
- [ ] Tap heart on a ChefVideoCard — it fills red
- [ ] Open VideoModal — see "Save" button in info bar
- [ ] Tap Save in modal — it changes to "Saved" with red heart
- [ ] Go to /favourites — see "Saved Videos" section below recipes
- [ ] Remove a video from favourites page — it disappears instantly
- [ ] Verify recipe favourites still work unchanged

**Step 3: Commit all remaining changes (if any)**

```bash
git add -A
git commit -m "feat: video favourites — complete feature"
```
