# Multi-Video Chef Results Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show up to 3 most relevant YouTube videos per chef on the Chef's Table results page, instead of 1.

**Architecture:** Change the YouTube API call from `maxResults=1` to `maxResults=3`, update the `ChefVideoResult` type from a single `video?` to a `videos` array, restructure the results page from a flat card grid to section-per-chef layout with video cards underneath, and update all consumers of the type.

**Tech Stack:** Next.js 15, Convex, TypeScript, Tailwind CSS, Vitest, Playwright

---

### Task 1: Update `ChefVideoResult` type

**Files:**
- Modify: `types/recipe.ts:28-38`

**Step 1: Update the type definition**

Change `video?` to `videos` array:

```typescript
export type ChefVideoResult = {
  chefId: string;
  chefName: string;
  chefEmoji: string;
  found: boolean;
  videos: {
    title: string;
    thumbnail: string;
    videoId: string;
  }[];
};
```

**Step 2: Commit**

```bash
git add types/recipe.ts
git commit -m "refactor: change ChefVideoResult.video to videos array"
```

---

### Task 2: Update backend to return up to 3 videos

**Files:**
- Modify: `convex/chefs.ts:45` (maxResults)
- Modify: `convex/chefs.ts:57-72` (result mapping)

**Step 1: Change `maxResults` from `"1"` to `"3"`**

At line 45:
```typescript
url.searchParams.set("maxResults", "3");
```

**Step 2: Update result mapping to return `videos` array**

Replace lines 57-72 with:

```typescript
          const items = data.items ?? [];
          const videos = items.map((item: any) => ({
            title: item.snippet.title as string,
            thumbnail: item.snippet.thumbnails.medium.url as string,
            videoId: item.id.videoId as string,
          }));

          return {
            chefId: chef.id,
            chefName: chef.name,
            chefEmoji: chef.emoji,
            found: videos.length > 0,
            videos,
          };
```

**Step 3: Update the error/no-API-key return shapes**

The graceful degradation at line 25-30 and error returns at lines 54 and 75 need `videos: []` instead of no `video` field:

```typescript
// Line 25-30 (no API key):
return args.chefs.map((chef) => ({
  chefId: chef.id,
  chefName: chef.name,
  chefEmoji: chef.emoji,
  found: false,
  videos: [],
}));

// Line 54 (API error) and line 75 (catch):
return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false, videos: [] };
```

**Step 4: Commit**

```bash
git add convex/chefs.ts
git commit -m "feat: return up to 3 videos per chef from YouTube API"
```

---

### Task 3: Update `ChefVideoCard` to render a single video

**Files:**
- Modify: `components/ChefVideoCard.tsx`

The card no longer handles the "not found" state or chef identity — it becomes a pure video card. The chef header and not-found state move to the results page.

**Step 1: Rewrite ChefVideoCard**

```typescript
// Displays a single YouTube video thumbnail card.
// Chef identity is shown in the section header on the results page.

type VideoInfo = {
  title: string;
  thumbnail: string;
  videoId: string;
};

type Props = {
  video: VideoInfo;
  chefName: string;
  chefEmoji: string;
  onPlay: (video: VideoInfo & { chefName: string; chefEmoji: string }) => void;
};

export function ChefVideoCard({ video, chefName, chefEmoji, onPlay }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPlay({ ...video, chefName, chefEmoji })}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full cursor-pointer"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full aspect-video object-cover"
        />
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
          aria-label="Play video"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
              <path d="M6 4l12 6-12 6V4z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Tap to play</p>
      </div>
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add components/ChefVideoCard.tsx
git commit -m "refactor: simplify ChefVideoCard to render a single video"
```

---

### Task 4: Update results page to section-per-chef layout

**Files:**
- Modify: `app/chef-results/page.tsx`

**Step 1: Rewrite the results page**

```typescript
"use client";
// Chef's Table results page — reads video results from localStorage
// (set by home page after searchChefVideos action completes).
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import { VideoModal } from "@/components/VideoModal";
import type { ChefVideoResult } from "@/types/recipe";

type ActiveVideo = {
  title: string;
  thumbnail: string;
  videoId: string;
  chefName: string;
  chefEmoji: string;
};

export default function ChefResultsPage() {
  const [results, setResults] = useState<ChefVideoResult[] | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("chefTableResults");
    if (stored) {
      try {
        setResults(JSON.parse(stored));
      } catch {
        setResults([]);
      }
    } else {
      setResults([]);
    }
  }, []);

  if (results === null) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center pb-20">
        <p className="text-2xl animate-bounce">🍳</p>
      </div>
    );
  }

  const foundCount = results.filter((r) => r.found).length;
  const totalVideos = results.reduce((sum, r) => sum + (r.videos?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/?tab=chefs-table" className="text-[#D4622A] text-sm mb-6 block hover:underline mt-6 sm:mt-0">
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">
          Here&apos;s what the chefs would cook
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {totalVideos > 0
            ? `${totalVideos} video${totalVideos > 1 ? "s" : ""} found from ${foundCount} chef${foundCount > 1 ? "s" : ""}`
            : "No videos found — try different ingredients"}
        </p>

        {results.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No results to show.</p>
            <Link href="/" className="text-[#D4622A] font-semibold">
              Start a new search
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {results.map((result) => (
              <section key={result.chefId}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{result.chefEmoji}</span>
                  <h2 className="text-lg font-semibold text-[#1A3A2A]">{result.chefName}</h2>
                </div>

                {!result.found || !result.videos?.length ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                    <p className="text-gray-400 text-sm">No matching videos for these ingredients.</p>
                    <p className="text-gray-400 text-xs mt-1">Try different ingredients.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {result.videos.map((video) => (
                      <ChefVideoCard
                        key={video.videoId}
                        video={video}
                        chefName={result.chefName}
                        chefEmoji={result.chefEmoji}
                        onPlay={setActiveVideo}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {activeVideo && (
        <VideoModal
          videoId={activeVideo.videoId}
          title={activeVideo.title}
          chefName={activeVideo.chefName}
          chefEmoji={activeVideo.chefEmoji}
          thumbnail={activeVideo.thumbnail}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/chef-results/page.tsx
git commit -m "feat: section-per-chef layout with up to 3 video cards each"
```

---

### Task 5: Verify the build compiles

**Step 1: Run the build**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table && npx next build
```

Expected: Build succeeds with no type errors.

**Step 2: Fix any type errors if found**

Check that all consumers of `ChefVideoResult` are updated. Known consumers:
- `components/Sidebar.tsx:324` — reads `entry.videoResults` (stores/restores from history). This is `ChefVideoResult[]` which now has `videos` instead of `video`. The Sidebar just serializes/deserializes, so the shape change flows through transparently.
- `components/HomePage.tsx:234` — stores results from `searchChefVideos`. Same — just passes through.

**Step 3: Commit if any fixes were needed**

---

### Task 6: Run existing tests

**Step 1: Run unit tests**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table && npx vitest run
```

Expected: All pass. The existing `chefs.test.ts` tests chef data and `getSelectedChefs` — unaffected by this change.

**Step 2: Run e2e tests (if Playwright is configured)**

```bash
npx playwright test tests/e2e/chef-table.spec.ts
```

Expected: All pass. These test tab switching and chef selection — not the results page rendering.

---

### Task 7: Manual smoke test

**Step 1: Start dev server**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table && npm run dev
```

**Step 2: Test the flow**

1. Go to localhost, switch to Chef's Table tab
2. Enter ingredients (e.g. "chicken, rice, garlic")
3. Select 2 chefs, click Find Recipes
4. Verify results page shows chef sections with up to 3 video cards each
5. Tap a video card — verify modal plays correctly
6. Go back, check history entry re-opens correctly from sidebar
