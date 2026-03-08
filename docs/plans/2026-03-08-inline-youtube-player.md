# Inline YouTube Video Player Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the "open in new tab" YouTube link behavior on Chef's Table video cards with an in-app modal player.

**Architecture:** New `VideoModal` component renders a YouTube iframe embed inside a backdrop overlay. `ChefVideoCard` changes from an `<a>` tag to a `<button>` that calls an `onPlay` callback. The `chef-results` page manages `activeVideo` state and conditionally renders the modal.

**Tech Stack:** React, TypeScript, Tailwind CSS, YouTube iframe embed API

---

### Task 1: Create the VideoModal component

**Files:**
- Create: `components/VideoModal.tsx`
- Test: `tests/unit/VideoModal.test.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/VideoModal.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VideoModal } from "@/components/VideoModal";

const props = {
  videoId: "abc123",
  title: "Gordon's Perfect Pasta",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
  onClose: vi.fn(),
};

describe("VideoModal", () => {
  it("renders a YouTube iframe with the correct embed URL", () => {
    render(<VideoModal {...props} />);
    const iframe = screen.getByTitle(props.title);
    expect(iframe).toHaveAttribute(
      "src",
      "https://www.youtube.com/embed/abc123?autoplay=1&rel=0"
    );
  });

  it("renders the video title and chef info", () => {
    render(<VideoModal {...props} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("🍳")).toBeInTheDocument();
  });

  it("renders a Watch on YouTube link", () => {
    render(<VideoModal {...props} />);
    const link = screen.getByRole("link", { name: /watch on youtube/i });
    expect(link).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=abc123"
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("calls onClose when close button is clicked", () => {
    render(<VideoModal {...props} />);
    const closeBtn = screen.getByLabelText("Close video");
    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<VideoModal {...props} onClose={onClose} />);
    const backdrop = screen.getByTestId("video-modal-backdrop");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<VideoModal {...props} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("has correct ARIA attributes for dialog", () => {
    render(<VideoModal {...props} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/VideoModal.test.tsx`
Expected: FAIL — module `@/components/VideoModal` not found

**Step 3: Write the VideoModal component**

Create `components/VideoModal.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

type Props = {
  videoId: string;
  title: string;
  chefName: string;
  chefEmoji: string;
  thumbnail: string;
  onClose: () => void;
};

export function VideoModal({ videoId, title, chefName, chefEmoji, thumbnail, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    // Mobile scroll lock
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        window.scrollTo(0, scrollY);
        previousFocusRef.current?.focus();
      };
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing: ${title}`}
      ref={modalRef}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        data-testid="video-modal-backdrop"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-[95vw] md:w-full md:max-w-[800px] mx-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-10 right-0 md:-top-10 md:right-0 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-20"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>

        {/* Video player */}
        <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden">
          {/* Thumbnail placeholder while iframe loads */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="absolute inset-0 w-full h-full z-10"
          />
        </div>

        {/* Info bar */}
        <div className="bg-white rounded-b-xl px-4 py-3">
          <p className="text-[#1A3A2A] font-semibold text-sm line-clamp-2">{title}</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <span>{chefEmoji}</span>
              <span className="text-sm text-[#D4622A] font-medium">{chefName}</span>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Watch on YouTube ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/VideoModal.test.tsx`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add components/VideoModal.tsx tests/unit/VideoModal.test.tsx
git commit -m "feat: add VideoModal component for inline YouTube playback"
```

---

### Task 2: Update ChefVideoCard to emit onPlay instead of linking

**Files:**
- Modify: `components/ChefVideoCard.tsx`
- Modify: `tests/unit/ChefVideoCard.test.tsx`

**Step 1: Update the tests**

Replace `tests/unit/ChefVideoCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import type { ChefVideoResult } from "@/types/recipe";

const foundResult: ChefVideoResult = {
  chefId: "gordon-ramsay",
  chefName: "Gordon Ramsay",
  chefEmoji: "🍳",
  found: true,
  video: {
    title: "Gordon's Perfect Pasta",
    thumbnail: "https://img.youtube.com/vi/abc123/mqdefault.jpg",
    videoId: "abc123",
  },
};

const notFoundResult: ChefVideoResult = {
  chefId: "jamie-oliver",
  chefName: "Jamie Oliver",
  chefEmoji: "🍕",
  found: false,
};

describe("ChefVideoCard", () => {
  it("renders video thumbnail and title when found", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute(
      "src",
      foundResult.video!.thumbnail
    );
  });

  it("calls onPlay with the result when clicked", () => {
    const onPlay = vi.fn();
    render(<ChefVideoCard result={foundResult} onPlay={onPlay} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onPlay).toHaveBeenCalledWith(foundResult);
  });

  it("does not render a link to YouTube", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows play icon overlay on thumbnail", () => {
    render(<ChefVideoCard result={foundResult} onPlay={vi.fn()} />);
    expect(screen.getByLabelText("Play video")).toBeInTheDocument();
  });

  it("shows no result state when not found", () => {
    render(<ChefVideoCard result={notFoundResult} onPlay={vi.fn()} />);
    expect(screen.getByText("Jamie Oliver")).toBeInTheDocument();
    expect(screen.getByText(/no video found/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ChefVideoCard.test.tsx`
Expected: FAIL — `onPlay` prop not expected, button role not found

**Step 3: Update ChefVideoCard component**

Replace `components/ChefVideoCard.tsx`:

```tsx
// Displays a single YouTube video result from a chef's channel.
// Shows a "no result" state gracefully if the chef had no matching video.
import type { ChefVideoResult } from "@/types/recipe";

type Props = {
  result: ChefVideoResult;
  onPlay: (result: ChefVideoResult) => void;
};

export function ChefVideoCard({ result, onPlay }: Props) {
  if (!result.found || !result.video) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <span className="text-3xl mb-2">{result.chefEmoji}</span>
        <p className="font-semibold text-[#1A3A2A] text-sm">{result.chefName}</p>
        <p className="text-gray-400 text-sm mt-2">😕 No video found for these ingredients.</p>
        <p className="text-gray-400 text-xs mt-1">Try different ingredients.</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPlay(result)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.video.thumbnail}
          alt={result.video.title}
          className="w-full aspect-video object-cover"
        />
        {/* Play icon overlay */}
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
        <div className="flex items-center gap-2 mb-2">
          <span>{result.chefEmoji}</span>
          <span className="text-sm font-semibold text-[#D4622A]">{result.chefName}</span>
        </div>
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{result.video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Tap to play</p>
      </div>
    </button>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ChefVideoCard.test.tsx`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add components/ChefVideoCard.tsx tests/unit/ChefVideoCard.test.tsx
git commit -m "feat: change ChefVideoCard from link to button with onPlay callback"
```

---

### Task 3: Wire up the modal in chef-results page

**Files:**
- Modify: `app/chef-results/page.tsx`

**Step 1: Update chef-results page to manage activeVideo state and render VideoModal**

Replace `app/chef-results/page.tsx`:

```tsx
"use client";
// Chef's Table results page — reads video results from localStorage
// (set by home page after searchChefVideos action completes).
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import { VideoModal } from "@/components/VideoModal";
import type { ChefVideoResult } from "@/types/recipe";

export default function ChefResultsPage() {
  const [results, setResults] = useState<ChefVideoResult[] | null>(null);
  const [activeVideo, setActiveVideo] = useState<ChefVideoResult | null>(null);

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

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/" className="text-[#D4622A] text-sm mb-6 block hover:underline mt-6 sm:mt-0">
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">
          Here&apos;s what the chefs would cook
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {foundCount > 0
            ? `${foundCount} video${foundCount > 1 ? "s" : ""} found from your selected chefs`
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {results.map((result) => (
              <ChefVideoCard
                key={result.chefId}
                result={result}
                onPlay={setActiveVideo}
              />
            ))}
          </div>
        )}
      </div>

      {activeVideo?.video && (
        <VideoModal
          videoId={activeVideo.video.videoId}
          title={activeVideo.video.title}
          chefName={activeVideo.chefName}
          chefEmoji={activeVideo.chefEmoji}
          thumbnail={activeVideo.video.thumbnail}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: Run all tests to verify nothing is broken**

Run: `npx vitest run`
Expected: All tests PASS

**Step 3: Manual test**

1. Open http://localhost:3000
2. Go to Chef's Table tab, select chefs, search with ingredients
3. On the results page, tap a video card → modal should open, video autoplays
4. Click X / click backdrop / press Escape → modal closes, back to grid
5. Tap a different card → new modal opens with new video
6. Check "Watch on YouTube ↗" link opens in new tab
7. Test on mobile viewport (Chrome DevTools) → verify scroll lock, sizing

**Step 4: Commit**

```bash
git add app/chef-results/page.tsx
git commit -m "feat: wire up VideoModal in chef-results page"
```

---

### Task 4: Handle history sidebar replay for chef results

**Files:**
- Check: `components/Sidebar.tsx` — verify that replaying a chef search from history still works (navigates to `/chef-results` which now uses `onPlay` prop)

This is a verification-only task. The history sidebar stores `chefTableResults` in localStorage and navigates to `/chef-results`. Since we only changed how the page renders (modal instead of links), no code changes are needed. Just verify manually:

**Step 1: Manual test**

1. Do a Chef's Table search so it appears in history
2. Open sidebar → tap the history entry
3. Verify `/chef-results` page loads correctly with video cards
4. Tap a video card → modal should work

Expected: No issues — the data flow is unchanged.
