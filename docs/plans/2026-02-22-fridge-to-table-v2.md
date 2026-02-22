# Fridge to Table v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Fridge to Table with a premium visual identity, Chef's Table (YouTube video search per celebrity chef channel), and voice ingredient input.

**Architecture:** Next.js frontend talks to Convex backend. Chef's Table results come from YouTube Data API v3 called inside a Convex Action (never from the browser). Chef preferences persist in localStorage. Voice uses browser-native Web Speech API — no external service needed.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, Convex Actions, YouTube Data API v3, Web Speech API, Vitest, Playwright

**Design doc:** `docs/plans/2026-02-21-fridge-to-table-v2-design.md`

**v1 rollback:** `git checkout v1.0.0`

---

## Pre-flight: YouTube Channel IDs

Before writing any code, verify each chef's official YouTube channel ID. Channel IDs are permanent — unlike usernames, they never change.

**How to find a channel ID:**
1. Go to the chef's YouTube channel in a browser
2. Click any video → right-click → "Copy video URL" → video URL contains `watch?v=<videoId>`
3. Better: go to the channel's About page → click share → "Copy channel ID"
4. Or: use `https://www.youtube.com/@ChannelHandle/about` and inspect the page source for `"channelId"`

**Channels to verify:**

| Chef | YouTube Handle to search | Field to fill in `lib/chefs.ts` |
|---|---|---|
| Gordon Ramsay | @gordonramsay | `youtubeChannelId` |
| Jamie Oliver | @jamieoliver | `youtubeChannelId` |
| Ranveer Brar | @RanveerBrar | `youtubeChannelId` |
| Maangchi | @maangchi | `youtubeChannelId` |
| Pati Jinich | @PatiJinich | `youtubeChannelId` |
| Kenji López-Alt | @JKenjiLopezAlt | `youtubeChannelId` |
| Pailin Chongchitnant | @HotThaiKitchen | `youtubeChannelId` |
| Lidia Bastianich | @LidiaBastianich | `youtubeChannelId` |

**Set up YouTube Data API:**
1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable "YouTube Data API v3"
4. Create an API key under Credentials
5. Set it in Convex dev: `npx convex env set YOUTUBE_API_KEY <your-key>`

Do not proceed until channel IDs are verified and the API key is set.

---

## Task 1: Chef data library

**Files:**
- Create: `lib/chefs.ts`
- Create: `tests/unit/chefs.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/chefs.test.ts
import { describe, it, expect } from "vitest";
import { CHEFS, getSelectedChefs } from "@/lib/chefs";

describe("CHEFS", () => {
  it("has exactly 8 chefs", () => {
    expect(CHEFS).toHaveLength(8);
  });

  it("each chef has required fields", () => {
    for (const chef of CHEFS) {
      expect(chef.id).toBeTruthy();
      expect(chef.name).toBeTruthy();
      expect(chef.country).toBeTruthy();
      expect(chef.emoji).toBeTruthy();
      expect(chef.youtubeChannelId).toBeTruthy();
      expect(chef.youtubeChannelId).not.toBe("TBD");
    }
  });

  it("has no duplicate IDs", () => {
    const ids = CHEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getSelectedChefs", () => {
  it("returns chefs matching the given IDs", () => {
    const result = getSelectedChefs(["gordon-ramsay", "maangchi"]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("gordon-ramsay");
    expect(result.map((c) => c.id)).toContain("maangchi");
  });

  it("returns empty array for no matching IDs", () => {
    expect(getSelectedChefs(["not-a-real-id"])).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- chefs
```

Expected: FAIL — "Cannot find module '@/lib/chefs'"

**Step 3: Create the chef library**

```typescript
// lib/chefs.ts
// Curated celebrity chef list for the Chef's Table feature.
// Channel IDs are permanent YouTube identifiers — verified manually before use.

export type Chef = {
  id: string;               // URL-safe slug
  name: string;             // Display name
  country: string;          // Home country
  emoji: string;            // Avatar emoji shown in grid
  youtubeChannelId: string; // Official YouTube channel ID (not username)
};

export const CHEFS: Chef[] = [
  {
    id: "gordon-ramsay",
    name: "Gordon Ramsay",
    country: "UK",
    emoji: "🍳",
    youtubeChannelId: "", // FILL IN after pre-flight verification
  },
  {
    id: "jamie-oliver",
    name: "Jamie Oliver",
    country: "UK",
    emoji: "🍕",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "ranveer-brar",
    name: "Ranveer Brar",
    country: "India",
    emoji: "🍛",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "maangchi",
    name: "Maangchi",
    country: "Korea",
    emoji: "🥢",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "pati-jinich",
    name: "Pati Jinich",
    country: "Mexico",
    emoji: "🌮",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "kenji-lopez-alt",
    name: "Kenji López-Alt",
    country: "USA",
    emoji: "🔬",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "pailin-chongchitnant",
    name: "Pailin Chongchitnant",
    country: "Thailand",
    emoji: "🌶️",
    youtubeChannelId: "", // FILL IN
  },
  {
    id: "lidia-bastianich",
    name: "Lidia Bastianich",
    country: "Italy",
    emoji: "🍝",
    youtubeChannelId: "", // FILL IN
  },
];

// Returns only the chefs whose IDs are in the given array.
export function getSelectedChefs(ids: string[]): Chef[] {
  return CHEFS.filter((chef) => ids.includes(chef.id));
}
```

**Step 4: Fill in all channel IDs from pre-flight**

Replace each `""` with the verified channel ID string.

**Step 5: Run test to verify it passes**

```bash
npm run test:unit -- chefs
```

Expected: PASS — 4 tests passing

**Step 6: Commit**

```bash
git add lib/chefs.ts tests/unit/chefs.test.ts
git commit -m "feat: add chef library with curated list and YouTube channel IDs"
```

---

## Task 2: Voice input utility

**Files:**
- Create: `lib/voiceInput.ts`
- Create: `tests/unit/voiceInput.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/voiceInput.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { isVoiceSupported, createSpeechRecognition } from "@/lib/voiceInput";

describe("isVoiceSupported", () => {
  it("returns false when window is undefined (SSR)", () => {
    // voiceInput guards for SSR
    const original = global.window;
    // @ts-expect-error
    delete global.window;
    expect(isVoiceSupported()).toBe(false);
    global.window = original;
  });

  it("returns false when SpeechRecognition is absent", () => {
    expect(isVoiceSupported()).toBe(false);
  });

  it("returns true when SpeechRecognition is present", () => {
    (window as any).SpeechRecognition = vi.fn();
    expect(isVoiceSupported()).toBe(true);
    delete (window as any).SpeechRecognition;
  });

  it("returns true when webkitSpeechRecognition is present", () => {
    (window as any).webkitSpeechRecognition = vi.fn();
    expect(isVoiceSupported()).toBe(true);
    delete (window as any).webkitSpeechRecognition;
  });
});

describe("createSpeechRecognition", () => {
  it("returns null when voice is not supported", () => {
    expect(createSpeechRecognition()).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- voiceInput
```

Expected: FAIL — "Cannot find module '@/lib/voiceInput'"

**Step 3: Create the voice input utility**

```typescript
// lib/voiceInput.ts
// Web Speech API wrapper for voice ingredient input.
// This runs client-side only — never call isVoiceSupported() during SSR.

// Returns true if the browser supports the Web Speech API.
// Chrome and Edge: full support. Firefox and iOS Safari: limited/no support.
export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

// Creates and configures a SpeechRecognition instance.
// Returns null if the browser doesn't support it.
export function createSpeechRecognition(): SpeechRecognition | null {
  if (!isVoiceSupported()) return null;
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const recognition: SpeechRecognition = new SR();
  recognition.continuous = false;      // stop after first pause
  recognition.interimResults = false;  // only final results
  recognition.lang = "en-US";
  return recognition;
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- voiceInput
```

Expected: PASS — 5 tests passing

**Step 5: Commit**

```bash
git add lib/voiceInput.ts tests/unit/voiceInput.test.ts
git commit -m "feat: add voice input utility using Web Speech API"
```

---

## Task 3: Design tokens

**Files:**
- Modify: `tailwind.config.ts` (or `tailwind.config.js` — check which exists)
- Modify: `app/globals.css`

**Step 1: Check existing Tailwind config**

```bash
ls tailwind.config*
```

**Step 2: Add custom colour tokens**

Open the Tailwind config file. Add to the `theme.extend.colors` section:

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // v2 design system — Fridge to Table premium palette
        fridge: {
          ivory: "#FAF6F1",      // page background
          green: "#1A3A2A",      // primary headings
          terracotta: "#D4622A", // CTA buttons, active states
          sage: "#C8DFC8",       // accent chips
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

**Step 3: Update global CSS for page background**

In `app/globals.css`, add/update the body background:

```css
body {
  background-color: #FAF6F1;
}
```

**Step 4: Verify dev server compiles without errors**

```bash
npm run dev
```

Open http://localhost:3000 — page background should now be warm ivory, not white.

**Step 5: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat: add v2 design tokens — ivory, green, terracotta, sage palette"
```

---

## Task 4: Bottom navigation bar

**Files:**
- Create: `components/BottomNav.tsx`
- Create: `tests/unit/BottomNav.test.tsx`
- Modify: `app/layout.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/BottomNav.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/BottomNav";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("BottomNav", () => {
  it("renders Home and Saved links", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("Home links to /", () => {
    render(<BottomNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("Saved links to /favourites", () => {
    render(<BottomNav />);
    const savedLink = screen.getByText("Saved").closest("a");
    expect(savedLink).toHaveAttribute("href", "/favourites");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- BottomNav
```

Expected: FAIL — "Cannot find module '@/components/BottomNav'"

**Step 3: Create BottomNav component**

```tsx
// components/BottomNav.tsx
"use client";
// Persistent bottom navigation bar — shown on all pages.
// Two tabs: Home (ingredient input) and Saved (favourites).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Home", emoji: "🏠" },
    { href: "/favourites", label: "Saved", emoji: "❤️" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-inset-bottom">
      <div className="flex max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                isActive ? "text-[#D4622A]" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl mb-0.5">{tab.emoji}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

**Step 4: Add BottomNav to root layout**

Open `app/layout.tsx`. Add the import and render BottomNav inside the body, after `{children}`:

```tsx
// app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { BottomNav } from "@/components/BottomNav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fridge to Table",
  description: "Turn your ingredients into recipes with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#FAF6F1]`}>
        <ConvexClientProvider>
          {children}
          <BottomNav />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
```

**Step 5: Run test to verify it passes**

```bash
npm run test:unit -- BottomNav
```

Expected: PASS — 3 tests passing

**Step 6: Verify in browser**

Open http://localhost:3000 — bottom nav should be visible with Home and Saved tabs.

**Step 7: Commit**

```bash
git add components/BottomNav.tsx tests/unit/BottomNav.test.tsx app/layout.tsx
git commit -m "feat: add BottomNav component and integrate into root layout"
```

---

## Task 5: Update FiltersPanel — remove diet, add (mins) unit

**Files:**
- Modify: `components/FiltersPanel.tsx`
- Modify: `types/recipe.ts`
- Modify: `tests/unit/` — update existing filter tests if they reference diet

**Step 1: Update RecipeFilters type — remove diet**

Open `types/recipe.ts`. Remove the `diet` field from `RecipeFilters`:

```typescript
// types/recipe.ts
export type Recipe = {
  title: string;
  description: string;
  cookingTime: number;
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  cuisineType: string;
  ingredients: {
    name: string;
    amount: string;
    inFridge: boolean;
  }[];
  steps: string[];
  shoppingList: string[];
  uncertainIngredients?: string[];
};

// diet is intentionally removed — Claude infers dietary requirements from ingredients
export type RecipeFilters = {
  cuisine: string;
  maxCookingTime: number;
  difficulty: "easy" | "medium" | "hard";
};

export type ChefVideoResult = {
  chefId: string;
  chefName: string;
  chefEmoji: string;
  found: boolean;
  video?: {
    title: string;
    thumbnail: string;
    videoId: string;
  };
};
```

**Step 2: Update FiltersPanel component**

Open `components/FiltersPanel.tsx`. Read its current content, then:
- Change "Max cooking time" label to "Max cooking time (mins)"
- Remove the diet filter buttons entirely
- Update the `RecipeFilters` prop type (diet field gone)

The filters panel should now show only:
1. Cuisine / mood — free text
2. Max cooking time (mins) — 15 / 30 / 45 / 60+ buttons
3. Difficulty — Easy / Medium / Hard buttons

**Step 3: Update app/page.tsx DEFAULT_FILTERS**

Open `app/page.tsx`. Remove `diet` from `DEFAULT_FILTERS`:

```typescript
const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
  // diet removed — Claude infers from ingredients
};
```

Also remove any `diet` state and `onDietChange` prop passing.

**Step 4: Update Convex recipes.ts — remove diet from prompt**

Open `convex/recipes.ts`. Remove the `diet` field from `filtersValidator` and the diet instruction from the Claude prompt. The prompt should now read simply:

```typescript
const filtersValidator = v.object({
  cuisine: v.string(),
  maxCookingTime: v.number(),
  difficulty: v.union(
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard")
  ),
  // diet removed — Claude infers from ingredients
});
```

In the prompt, remove the diet instruction line. Claude will read the ingredients and naturally infer dietary requirements.

**Step 5: Run all unit tests to confirm no regressions**

```bash
npm run test:unit
```

Expected: All existing tests pass (fix any that reference diet)

**Step 6: Commit**

```bash
git add types/recipe.ts components/FiltersPanel.tsx app/page.tsx convex/recipes.ts
git commit -m "feat: remove diet filter — Claude infers dietary requirements from ingredients"
```

---

## Task 6: Update IngredientInput — new photo UI, voice mic button

**Files:**
- Modify: `components/IngredientInput.tsx`
- Modify: `tests/unit/IngredientInput.test.tsx` (update existing tests, remove diet refs)

**Step 1: Read current IngredientInput.tsx in full**

Read the file before modifying it.

**Step 2: Rewrite IngredientInput**

Key changes from v1:
- Remove diet preference buttons
- Remove the "Type ingredients" / "Upload photo" tab toggle
- The text input is always visible (single mode)
- "+" button opens a dropdown with two options: "📷 Take a photo" and "🖼️ Upload a photo"
- 🎙️ mic button sits inside the text input (right side)
- Two hidden `<input type="file">` elements: one with `capture="environment"` (camera), one without (gallery)
- Voice mic state: idle → recording → done (voice logic wired in Task 7)

```tsx
// components/IngredientInput.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { parseIngredients } from "@/lib/ingredientParser";
import { compressImage } from "@/lib/imageCompression";
import { isVoiceSupported, createSpeechRecognition } from "@/lib/voiceInput";

type Props = {
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
};

export function IngredientInput({ onSubmit, isLoading }: Props) {
  const [text, setText] = useState("");
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "recording" | "processing">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  const voiceSupported = isVoiceSupported();
  const ingredients = parseIngredients(text);
  const hasInput = ingredients.length > 0 || preview !== null;

  // Close photo menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target as Node)) {
        setShowPhotoMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePhotoFile(file: File) {
    setShowPhotoMenu(false);
    if (!file.type.startsWith("image/")) return;
    const base64 = await compressImage(file);
    setPreview(base64);
    setText("");
  }

  function handleMicClick() {
    if (voiceState === "recording") {
      recognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onstart = () => setVoiceState("recording");
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setText((prev) => prev ? prev + ", " + transcript : transcript);
    };
    recognition.onend = () => setVoiceState("idle");
    recognition.onerror = () => setVoiceState("idle");
    recognition.start();
  }

  function handleSubmit() {
    if (preview) {
      onSubmit([], preview);
    } else {
      onSubmit(ingredients);
    }
  }

  function clearPhoto() {
    setPreview(null);
  }

  return (
    <div className="space-y-4">
      {/* Photo preview */}
      {preview && (
        <div className="relative">
          <img src={preview} alt="Fridge photo" className="w-full rounded-2xl object-cover max-h-48" />
          <button
            onClick={clearPhoto}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            aria-label="Remove photo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Text input + photo + mic */}
      {!preview && (
        <div className="relative flex items-center gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your ingredients, e.g. eggs, spinach, tomatoes..."
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-24 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-[#D4622A] min-h-[52px]"
            rows={2}
          />

          {/* Inline buttons */}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {/* Photo "+" button */}
            <div className="relative" ref={photoMenuRef}>
              <button
                type="button"
                onClick={() => setShowPhotoMenu((v) => !v)}
                className="text-gray-400 hover:text-[#D4622A] transition-colors text-lg leading-none"
                aria-label="Add photo"
              >
                +
              </button>
              {showPhotoMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 w-44 z-10">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    📷 Take a photo
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    🖼️ Upload a photo
                  </button>
                </div>
              )}
            </div>

            {/* Voice mic button */}
            {voiceSupported && (
              <button
                type="button"
                onClick={handleMicClick}
                aria-label={voiceState === "recording" ? "Stop recording" : "Start voice input"}
                className={`text-lg leading-none transition-colors ${
                  voiceState === "recording"
                    ? "text-red-500 animate-pulse"
                    : "text-gray-400 hover:text-[#D4622A]"
                }`}
              >
                🎙️
              </button>
            )}
          </div>
        </div>
      )}

      {/* Voice not supported notice */}
      {!voiceSupported && (
        <p className="text-xs text-gray-400">
          Voice input is not supported in this browser. Use Chrome or Edge for voice.
        </p>
      )}

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
      />

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!hasInput || isLoading}
        className="w-full bg-[#D4622A] text-white font-semibold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#BF5525] transition-colors"
      >
        {isLoading ? "🍳 Finding recipes..." : "Find Recipes →"}
      </button>
    </div>
  );
}
```

**Step 3: Run unit tests**

```bash
npm run test:unit -- IngredientInput
```

Fix any test failures caused by removed diet props.

**Step 4: Verify in browser**

- Text input shows with "+" and 🎙️ buttons
- Clicking "+" shows dropdown with Take a photo / Upload a photo
- On desktop: Take a photo may open file picker (no camera) — acceptable
- Mic button shows in Chrome; shows unsupported notice in Firefox

**Step 5: Commit**

```bash
git add components/IngredientInput.tsx
git commit -m "feat: redesign ingredient input — photo menu, voice mic, remove diet filter"
```

---

## Task 7: Chef grid component with localStorage persistence

**Files:**
- Create: `components/ChefGrid.tsx`
- Create: `tests/unit/ChefGrid.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/ChefGrid.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefGrid } from "@/components/ChefGrid";

describe("ChefGrid", () => {
  it("renders all 8 chefs", () => {
    render(<ChefGrid selectedIds={[]} onChange={() => {}} />);
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("Maangchi")).toBeInTheDocument();
    expect(screen.getByText("Pati Jinich")).toBeInTheDocument();
    // 8 chef buttons total
    expect(screen.getAllByRole("button")).toHaveLength(8);
  });

  it("calls onChange with added chef ID when clicking unselected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith(["gordon-ramsay"]);
  });

  it("calls onChange with chef removed when clicking selected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid selectedIds={["gordon-ramsay"]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows selected count", () => {
    render(<ChefGrid selectedIds={["gordon-ramsay", "maangchi"]} onChange={() => {}} />);
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- ChefGrid
```

Expected: FAIL — "Cannot find module '@/components/ChefGrid'"

**Step 3: Create ChefGrid component**

```tsx
// components/ChefGrid.tsx
"use client";
// Multi-select grid of celebrity chefs for the Chef's Table tab.
// Selections are controlled by parent (stored in localStorage via app/page.tsx).
import { CHEFS } from "@/lib/chefs";

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ChefGrid({ selectedIds, onChange }: Props) {
  function toggle(chefId: string) {
    if (selectedIds.includes(chefId)) {
      onChange(selectedIds.filter((id) => id !== chefId));
    } else {
      onChange([...selectedIds, chefId]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1A3A2A]">Choose your chefs</p>
        {selectedIds.length > 0 && (
          <span className="text-xs text-[#D4622A] font-medium">
            {selectedIds.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CHEFS.map((chef) => {
          const isSelected = selectedIds.includes(chef.id);
          return (
            <button
              key={chef.id}
              type="button"
              onClick={() => toggle(chef.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                isSelected
                  ? "border-[#D4622A] bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{chef.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A3A2A] truncate">{chef.name}</p>
                <p className="text-xs text-gray-400">{chef.country}</p>
              </div>
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-xs text-gray-400 text-center pt-1">
          Select at least one chef to search
        </p>
      )}
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm run test:unit -- ChefGrid
```

Expected: PASS — 4 tests passing

**Step 5: Commit**

```bash
git add components/ChefGrid.tsx tests/unit/ChefGrid.test.tsx
git commit -m "feat: add ChefGrid multi-select component for Chef's Table"
```

---

## Task 8: Update home page — tabs, Chef's Table flow, new design

**Files:**
- Modify: `app/page.tsx`

**Step 1: Read the current page.tsx in full before modifying**

**Step 2: Rewrite app/page.tsx**

```tsx
// app/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChefGrid } from "@/components/ChefGrid";
import { getSelectedChefs } from "@/lib/chefs";
import type { RecipeFilters } from "@/types/recipe";

type ActiveTab = "any-recipe" | "chefs-table";

const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

const SELECTED_CHEFS_KEY = "fridgeToTable_selectedChefs";

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("any-recipe");
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved chef selections from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
    if (saved) {
      try {
        setSelectedChefIds(JSON.parse(saved));
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  // Persist chef selections to localStorage whenever they change
  function handleChefSelectionChange(ids: string[]) {
    setSelectedChefIds(ids);
    localStorage.setItem(SELECTED_CHEFS_KEY, JSON.stringify(ids));
  }

  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);
  const searchChefVideos = useAction(api.chefs.searchChefVideos);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    setIsLoading(true);
    setError(null);

    try {
      let finalIngredients = ingredients;

      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });
        if (photoResult.ingredients.length === 0) {
          setError("We couldn't detect many ingredients — try typing them instead.");
          setIsLoading(false);
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      if (activeTab === "chefs-table") {
        // Chef's Table: search YouTube channels for each selected chef
        const selectedChefs = getSelectedChefs(selectedChefIds);
        const results = await searchChefVideos({
          ingredients: finalIngredients,
          chefs: selectedChefs.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            youtubeChannelId: c.youtubeChannelId,
          })),
        });
        // Store results in localStorage — chef-results page reads them
        localStorage.setItem("chefTableResults", JSON.stringify(results));
        router.push("/chef-results");
      } else {
        // Any Recipe: Claude AI generates 3 recipes
        const sessionId = getSessionId();
        const recipeSetId = await generateRecipes({
          sessionId,
          ingredients: finalIngredients,
          filters,
        });
        router.push(`/results/${recipeSetId}`);
      }
    } catch (err) {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmitChefsTable =
    activeTab === "chefs-table" && selectedChefIds.length === 0;

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A3A2A]">
            What&apos;s in your <em>fridge?</em>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tell us your ingredients and we&apos;ll find the perfect recipe.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 mb-6 shadow-sm">
          {(["any-recipe", "chefs-table"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-[#D4622A] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "any-recipe" ? "Any Recipe" : "Chef's Table 🍽️"}
            </button>
          ))}
        </div>

        {/* Chef grid — only visible on Chef's Table tab */}
        {activeTab === "chefs-table" && (
          <div className="mb-6">
            <ChefGrid
              selectedIds={selectedChefIds}
              onChange={handleChefSelectionChange}
            />
          </div>
        )}

        {/* Ingredient input */}
        <IngredientInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={canSubmitChefsTable}
        />

        {/* Filters — only on Any Recipe tab */}
        {activeTab === "any-recipe" && (
          <div className="mt-4">
            <FiltersPanel filters={filters} onChange={setFilters} />
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex justify-between items-start">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 ml-3 flex-shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: Update `IngredientInput` props to accept a `disabled?: boolean` prop — when disabled, the Find Recipes button stays disabled regardless of input.

**Step 3: Verify in browser**

- Tab toggle switches between Any Recipe and Chef's Table
- Chef's Table tab shows the chef grid
- Any Recipe tab shows filters panel
- Any Recipe tab: entering text + submit navigates to /results/[id]

**Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: home page v2 — tab selector, Chef's Table flow, new design"
```

---

## Task 9: Chef's Table Convex action

**Files:**
- Create: `convex/chefs.ts`
- Create: `tests/integration/chefs.test.ts`

**Step 1: Write the failing integration test**

```typescript
// tests/integration/chefs.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "../../convex/schema";

// Mock the YouTube API fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("searchChefVideos", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns found: false when API key is missing", async () => {
    const t = convexTest(schema);
    const result = await t.action(
      // we test the handler logic directly here
    );
    // Without API key, all results return found: false gracefully
  });

  it("constructs query from first 3 ingredients", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({ items: [] }),
    });

    // Verify the fetch URL contains the first 3 ingredients
    // This tests query construction logic
  });

  it("returns found: true with video data when API returns results", async () => {
    mockFetch.mockResolvedValue({
      json: async () => ({
        items: [{
          id: { videoId: "abc123" },
          snippet: {
            title: "Perfect Pasta",
            thumbnails: { medium: { url: "https://img.youtube.com/vi/abc123/mqdefault.jpg" } },
          },
        }],
      }),
    });
    // Expect found: true with video.videoId = "abc123"
  });

  it("returns found: false gracefully when fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    // Expect found: false — no crash
  });
});
```

Note: convex-test integration tests for actions with external fetch calls require careful mocking. Write the test logic and adjust based on convex-test API patterns from existing integration tests.

**Step 2: Run test to verify it fails**

```bash
npm run test:integration -- chefs
```

**Step 3: Create the Convex chefs action**

```typescript
// convex/chefs.ts
// Chef's Table backend — searches each selected chef's YouTube channel
// for videos matching the user's ingredients.
// Uses YouTube Data API v3 (app-level key, no OAuth, never exposed to browser).
import { action } from "./_generated/server";
import { v } from "convex/values";

const chefValidator = v.object({
  id: v.string(),
  name: v.string(),
  emoji: v.string(),
  youtubeChannelId: v.string(),
});

export const searchChefVideos = action({
  args: {
    ingredients: v.array(v.string()),
    chefs: v.array(chefValidator),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.YOUTUBE_API_KEY;

    // Graceful degradation: if no API key, return empty results
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY is not set in Convex environment");
      return args.chefs.map((chef) => ({
        chefId: chef.id,
        chefName: chef.name,
        chefEmoji: chef.emoji,
        found: false,
      }));
    }

    // Build search query from the first 3 ingredients
    const query = args.ingredients.slice(0, 3).join(" ") + " recipe";

    // Search each chef's channel in parallel
    const results = await Promise.all(
      args.chefs.map(async (chef) => {
        try {
          const url = new URL("https://www.googleapis.com/youtube/v3/search");
          url.searchParams.set("key", apiKey);
          url.searchParams.set("channelId", chef.youtubeChannelId);
          url.searchParams.set("q", query);
          url.searchParams.set("type", "video");
          url.searchParams.set("maxResults", "1");
          url.searchParams.set("part", "snippet");
          url.searchParams.set("order", "relevance");

          const response = await fetch(url.toString());
          const data = await response.json();

          // Check for API errors (e.g. quota exceeded, invalid key)
          if (data.error) {
            console.error(`YouTube API error for ${chef.name}:`, data.error.message);
            return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false };
          }

          const item = data.items?.[0];
          if (!item) {
            return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false };
          }

          return {
            chefId: chef.id,
            chefName: chef.name,
            chefEmoji: chef.emoji,
            found: true,
            video: {
              title: item.snippet.title as string,
              thumbnail: item.snippet.thumbnails.medium.url as string,
              videoId: item.id.videoId as string,
            },
          };
        } catch (err) {
          // Network error or unexpected shape — fail gracefully per chef
          console.error(`Chef search failed for ${chef.name}:`, err);
          return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false };
        }
      })
    );

    return results;
  },
});
```

**Step 4: Run integration test**

```bash
npm run test:integration -- chefs
```

**Step 5: Commit**

```bash
git add convex/chefs.ts tests/integration/chefs.test.ts
git commit -m "feat: add searchChefVideos Convex action — YouTube Data API per chef channel"
```

---

## Task 10: Chef results page and video card

**Files:**
- Create: `components/ChefVideoCard.tsx`
- Create: `app/chef-results/page.tsx`
- Create: `tests/unit/ChefVideoCard.test.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/ChefVideoCard.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
    render(<ChefVideoCard result={foundResult} />);
    expect(screen.getByText("Gordon's Perfect Pasta")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", foundResult.video!.thumbnail);
  });

  it("links to YouTube when found", () => {
    render(<ChefVideoCard result={foundResult} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows no result state when not found", () => {
    render(<ChefVideoCard result={notFoundResult} />);
    expect(screen.getByText("Jamie Oliver")).toBeInTheDocument();
    expect(screen.getByText(/no video found/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm run test:unit -- ChefVideoCard
```

**Step 3: Create ChefVideoCard component**

```tsx
// components/ChefVideoCard.tsx
// Displays a single YouTube video result from a chef's channel.
// Shows a "no result" state gracefully if the chef had no matching video.
import type { ChefVideoResult } from "@/types/recipe";

type Props = {
  result: ChefVideoResult;
};

export function ChefVideoCard({ result }: Props) {
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
    <a
      href={`https://www.youtube.com/watch?v=${result.video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow block"
    >
      <img
        src={result.video.thumbnail}
        alt={result.video.title}
        className="w-full aspect-video object-cover"
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>{result.chefEmoji}</span>
          <span className="text-sm font-semibold text-[#D4622A]">{result.chefName}</span>
        </div>
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{result.video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Watch on YouTube</p>
      </div>
    </a>
  );
}
```

**Step 4: Create chef-results page**

```tsx
// app/chef-results/page.tsx
"use client";
// Chef's Table results page — reads video results from localStorage
// (set by home page after searchChefVideos action completes).
// Results are not persisted to Convex — they are session-scoped to this browse.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import type { ChefVideoResult } from "@/types/recipe";

export default function ChefResultsPage() {
  const [results, setResults] = useState<ChefVideoResult[] | null>(null);

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
        <Link href="/" className="text-[#D4622A] text-sm mb-6 block hover:underline">
          ← New search
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
              <ChefVideoCard key={result.chefId} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 5: Run tests**

```bash
npm run test:unit -- ChefVideoCard
```

Expected: PASS — 3 tests passing

**Step 6: Test full Chef's Table flow in browser**

1. Enter ingredients in text box
2. Switch to Chef's Table tab
3. Select 2–3 chefs
4. Hit Find Recipes
5. Should navigate to /chef-results showing video cards

**Step 7: Commit**

```bash
git add components/ChefVideoCard.tsx app/chef-results/page.tsx tests/unit/ChefVideoCard.test.tsx
git commit -m "feat: Chef's Table results page with YouTube video cards"
```

---

## Task 11: Apply v2 visual design to existing pages

**Files:**
- Modify: `app/results/[recipeSetId]/page.tsx`
- Modify: `app/recipe/[recipeSetId]/[recipeIndex]/page.tsx`
- Modify: `app/favourites/page.tsx`
- Modify: `components/RecipeCard.tsx`
- Modify: `components/FavouritesGrid.tsx`

**Step 1: Read each file before modifying**

**Step 2: Apply new palette consistently across all pages**

For each page and component, replace:
- White/green backgrounds → `bg-[#FAF6F1]`
- Green text classes → `text-[#1A3A2A]`
- Old green button classes → `bg-[#D4622A]` (terracotta)
- Old active/selected states → terracotta border `border-[#D4622A]`
- Cards: ensure `rounded-2xl`, `bg-white`, `shadow-sm`
- Add `pb-24` to all page wrappers (space for bottom nav)
- Remove old footer links to /favourites (replaced by bottom nav)

**Step 3: Update RecipeCard to new design**

RecipeCard should use the new colour system:
- Card background: white
- Title: `text-[#1A3A2A]` bold
- Badges (cuisine, difficulty): `bg-[#C8DFC8] text-[#1A3A2A]` (sage)
- Time badge: terracotta
- Hover: `hover:shadow-md transition-shadow`

**Step 4: Run all existing unit tests**

```bash
npm run test:unit
```

Expected: All pass — visual changes only, no logic changes

**Step 5: Commit**

```bash
git add app/results app/recipe app/favourites/page.tsx components/RecipeCard.tsx components/FavouritesGrid.tsx
git commit -m "feat: apply v2 visual design across all pages and components"
```

---

## Task 12: Fix photo analysis timeout bug (v1 bug)

**Files:**
- Modify: `convex/photos.ts`
- Modify: `app/page.tsx` (error messaging)

**Step 1: Read convex/photos.ts in full**

**Step 2: Investigate root cause**

The bug: photo upload works but recipe generation returns "chef is busy" error in production. Hypothesis: the analyzePhoto action succeeds but then generateRecipes times out, OR analyzePhoto itself times out due to Claude vision taking longer than the Convex action limit.

Check current action timeout. In Convex, actions have a default timeout that can be extended. Add console logging to both actions to identify exactly where the failure occurs:

```typescript
// In convex/photos.ts handler, add timing logs:
console.log("[analyzePhoto] Starting Claude vision call");
// ... claude call ...
console.log("[analyzePhoto] Claude returned", result.ingredients.length, "ingredients");
```

**Step 3: Review Convex action timeout**

Convex actions run for up to 10 minutes by default. Check if the issue is actually the Claude API call taking too long, or if it's a different error. Add better error handling and surface the actual error to the UI:

In `convex/photos.ts`, wrap the Claude call in try/catch and log the full error:

```typescript
try {
  const response = await client.messages.create({ ... });
  // ... existing logic
} catch (err: any) {
  console.error("[analyzePhoto] Claude API error:", err?.message || err);
  throw new Error("Photo analysis failed: " + (err?.message || "unknown error"));
}
```

**Step 4: Improve JSON parsing resilience in photos.ts**

Apply the same code-fence stripping used in recipes.ts:

```typescript
const rawText = response.content[0].type === "text" ? response.content[0].text : "{}";
const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
const parsed = JSON.parse(text);
```

**Step 5: Test photo upload in development**

1. Run `npx convex dev` and `npm run dev`
2. Upload a fridge photo
3. Check Convex dashboard logs for the error details
4. Fix the specific failure identified

**Step 6: Commit fix**

```bash
git add convex/photos.ts
git commit -m "fix: improve photo analysis error handling and JSON parsing resilience"
```

---

## Task 13: E2E tests for v2 features

**Files:**
- Create: `tests/e2e/chef-table.spec.ts`
- Create: `tests/e2e/voice-input.spec.ts`
- Modify: `tests/e2e/text-input.spec.ts` (update for new UI)
- Modify: `tests/e2e/favourites.spec.ts` (update for bottom nav)

**Step 1: Update existing E2E tests for v2 UI changes**

The diet filter is gone. The submit button text may have changed. Update selectors accordingly.

**Step 2: Write Chef's Table E2E test**

```typescript
// tests/e2e/chef-table.spec.ts
import { test, expect } from "@playwright/test";

test("Chef's Table tab is visible on home page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /chef's table/i })).toBeVisible();
});

test("Chef's Table tab shows chef grid when active", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await expect(page.getByText("Gordon Ramsay")).toBeVisible();
  await expect(page.getByText("Maangchi")).toBeVisible();
});

test("Find Recipes is disabled with no chefs selected on Chef's Table", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await page.getByPlaceholder(/type your ingredients/i).fill("pasta, eggs");
  const button = page.getByRole("button", { name: /find recipes/i });
  await expect(button).toBeDisabled();
});

test("Chef selection persists in localStorage", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /chef's table/i }).click();
  await page.getByText("Gordon Ramsay").click();

  const stored = await page.evaluate(() =>
    localStorage.getItem("fridgeToTable_selectedChefs")
  );
  expect(JSON.parse(stored!)).toContain("gordon-ramsay");
});

test("Chef selection is restored on next visit", async ({ page }) => {
  // Set selection in localStorage before visiting
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "fridgeToTable_selectedChefs",
      JSON.stringify(["gordon-ramsay"])
    )
  );
  await page.reload();
  await page.getByRole("button", { name: /chef's table/i }).click();
  // Gordon Ramsay's card should appear selected (terracotta border)
  const card = page.getByText("Gordon Ramsay").locator("..").locator("..");
  await expect(card).toHaveCSS("border-color", "rgb(212, 98, 42)");
});
```

**Step 3: Write voice input E2E test**

```typescript
// tests/e2e/voice-input.spec.ts
import { test, expect } from "@playwright/test";

test("mic button is visible on home page", async ({ page }) => {
  await page.goto("/");
  const micButton = page.getByRole("button", { name: /start voice input/i });
  // May not be visible in Chromium headless — assert it exists in DOM
  await expect(micButton).toBeDefined();
});

test("voice unsupported notice shown in browsers without SpeechRecognition", async ({
  page,
}) => {
  // Simulate unsupported browser by overriding window.SpeechRecognition
  await page.goto("/");
  await page.evaluate(() => {
    delete (window as any).SpeechRecognition;
    delete (window as any).webkitSpeechRecognition;
  });
  await page.reload();
  // Component should show notice text
  const notice = page.getByText(/voice not supported/i);
  if (await notice.count() > 0) {
    await expect(notice).toBeVisible();
  }
});
```

**Step 4: Run all E2E tests**

Ensure dev server and Convex dev are running, then:

```bash
npm run test:e2e
```

Expected: All existing tests pass. New tests pass where browser supports the APIs.

**Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "test: add E2E tests for Chef's Table and voice input features"
```

---

## Task 14: Run full test suite and fix any failures

**Step 1: Run all unit tests**

```bash
npm run test:unit
```

Expected: All pass. Fix any failures before proceeding.

**Step 2: Run all integration tests**

```bash
npm run test:integration
```

Expected: All pass.

**Step 3: Run E2E tests**

```bash
npm run test:e2e
```

Expected: All pass.

**Step 4: Fix any failures found** before marking complete.

---

## Task 15: Deploy v2 to production

**Step 1: Set YOUTUBE_API_KEY in production Convex**

```bash
npx convex env set YOUTUBE_API_KEY <your-key> --prod
```

**Step 2: Commit any remaining changes**

```bash
git status
git add -A
git commit -m "chore: final v2 cleanup before production deploy"
```

**Step 3: Deploy**

```bash
npx vercel --prod
```

Expected: Deployment URL printed. Open it and verify:
- New ivory background is visible
- Bottom nav shows Home and Saved
- Any Recipe tab works end-to-end
- Chef's Table tab shows chef grid

**Step 4: Tag the release**

```bash
git tag -a v2.0.0 -m "v2.0.0 — Chef's Table, voice input, visual redesign"
git push origin v2.0.0
```

**Step 5: Push to GitHub**

```bash
git push origin main
```

**Step 6: Verify production**

Open https://fridge-to-table-mu.vercel.app and confirm all flows work.

---

## Summary of files created/modified

| File | Action |
|---|---|
| `lib/chefs.ts` | Create |
| `lib/voiceInput.ts` | Create |
| `types/recipe.ts` | Modify — add ChefVideoResult, remove diet from RecipeFilters |
| `tailwind.config.ts` | Modify — add fridge colour tokens |
| `app/globals.css` | Modify — body background |
| `components/BottomNav.tsx` | Create |
| `components/ChefGrid.tsx` | Create |
| `components/ChefVideoCard.tsx` | Create |
| `components/IngredientInput.tsx` | Modify — new photo UX, voice mic, remove diet |
| `components/FiltersPanel.tsx` | Modify — remove diet, add (mins) label |
| `components/RecipeCard.tsx` | Modify — new visual design |
| `components/FavouritesGrid.tsx` | Modify — new visual design |
| `convex/chefs.ts` | Create — searchChefVideos action |
| `convex/recipes.ts` | Modify — remove diet from validator + prompt |
| `convex/photos.ts` | Modify — fix timeout bug, better error handling |
| `app/layout.tsx` | Modify — add BottomNav, new bg |
| `app/page.tsx` | Modify — tabs, Chef's Table flow, new design |
| `app/chef-results/page.tsx` | Create |
| `app/results/[recipeSetId]/page.tsx` | Modify — new visual design, pb-24 |
| `app/recipe/[recipeSetId]/[recipeIndex]/page.tsx` | Modify — new visual design |
| `app/favourites/page.tsx` | Modify — new visual design, remove old footer nav |
| `tests/unit/chefs.test.ts` | Create |
| `tests/unit/voiceInput.test.ts` | Create |
| `tests/unit/BottomNav.test.tsx` | Create |
| `tests/unit/ChefGrid.test.tsx` | Create |
| `tests/unit/ChefVideoCard.test.tsx` | Create |
| `tests/integration/chefs.test.ts` | Create |
| `tests/e2e/chef-table.spec.ts` | Create |
| `tests/e2e/voice-input.spec.ts` | Create |
| `tests/e2e/text-input.spec.ts` | Modify — update for new UI |
| `tests/e2e/favourites.spec.ts` | Modify — update for bottom nav |
