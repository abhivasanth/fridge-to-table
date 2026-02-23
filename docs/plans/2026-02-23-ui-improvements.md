# UI Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the home page into a full marketing landing page, redesign the voice input button, move filters above the submit button, and restore the v1 chef loading animation.

**Architecture:** The home page (`app/page.tsx`) becomes a single scrolling page: Navbar → Hero → App Playground → Features Section → Testimonials. Navigation switches from a global `BottomNav` to a `ClientNav` that shows `Navbar` on `/` and `BottomNav` on all other routes. `IngredientInput` gains a `beforeSubmit` slot and a redesigned standalone voice button.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4 (no config file — tokens in `globals.css` via `@theme inline`), `next/font/google`, Vitest + Testing Library, TypeScript

---

## Overview of Changes

| Task | What | Files |
|------|------|-------|
| 1 | Add Playfair Display font | `app/globals.css`, `app/layout.tsx` |
| 2 | `LoadingChef` component | `components/LoadingChef.tsx`, `tests/unit/LoadingChef.test.tsx` |
| 3 | `Navbar` component | `components/Navbar.tsx`, `tests/unit/Navbar.test.tsx` |
| 4 | `ClientNav` component | `components/ClientNav.tsx`, `tests/unit/ClientNav.test.tsx` |
| 5 | Update `layout.tsx` | `app/layout.tsx` |
| 6 | Voice button redesign in `IngredientInput` | `components/IngredientInput.tsx`, `tests/unit/IngredientInput.test.tsx` |
| 7 | `beforeSubmit` slot + filter placement in `IngredientInput` | `components/IngredientInput.tsx`, `app/page.tsx` |
| 8 | Landing page restructure (`page.tsx`) | `app/page.tsx` |

---

## Task 1: Add Playfair Display Font

**Goal:** Load Playfair Display via `next/font/google` and expose it as a CSS variable for use in headings across the landing page.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

### Step 1: Add the font import to `layout.tsx`

Add `PlayfairDisplay` alongside the existing Geist fonts. Exact change (add after the existing font imports, before the `metadata` export):

```typescript
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});
```

Update the `<body>` tag to include `playfairDisplay.variable`:

```tsx
<body className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased bg-[#FAF6F1]`}>
```

### Step 2: Register the font token in `globals.css`

Inside the existing `@theme inline { ... }` block, add below the existing font lines:

```css
--font-serif: var(--font-playfair);
```

### Step 3: Verify the font loads

Run the dev server:
```
npm run dev
```
Open http://localhost:3000. Open DevTools → Network → filter "playfair". Confirm the font file loads (200 OK). No red errors in console.

### Step 4: Commit

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add Playfair Display font via next/font/google"
```

---

## Task 2: `LoadingChef` Component (TDD)

**Goal:** A component shown while recipes are loading — bouncing chef emoji with cycling text messages.

**Files:**
- Create: `components/LoadingChef.tsx`
- Create: `tests/unit/LoadingChef.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/LoadingChef.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { LoadingChef } from "@/components/LoadingChef";

describe("LoadingChef", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the chef emoji", () => {
    render(<LoadingChef />);
    expect(screen.getByText("👨‍🍳")).toBeInTheDocument();
  });

  it("shows the first message initially", () => {
    render(<LoadingChef />);
    expect(screen.getByText("Checking your fridge...")).toBeInTheDocument();
  });

  it("cycles to the second message after 2 seconds", () => {
    render(<LoadingChef />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText("Consulting the chef...")).toBeInTheDocument();
  });

  it("cycles to the third message after 4 seconds", () => {
    render(<LoadingChef />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Almost ready...")).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm run test:unit -- --reporter=verbose LoadingChef
```
Expected: FAIL — "Cannot find module '@/components/LoadingChef'"

### Step 3: Implement `LoadingChef`

Create `components/LoadingChef.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";

const MESSAGES = [
  "Checking your fridge...",
  "Consulting the chef...",
  "Almost ready...",
];

export function LoadingChef() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <span className="text-6xl animate-bounce">👨‍🍳</span>
      <p className="text-sm text-gray-500 animate-pulse">{MESSAGES[messageIndex]}</p>
    </div>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm run test:unit -- --reporter=verbose LoadingChef
```
Expected: 4 tests PASS

### Step 5: Commit

```bash
git add components/LoadingChef.tsx tests/unit/LoadingChef.test.tsx
git commit -m "feat: add LoadingChef animation component with cycling messages"
```

---

## Task 3: `Navbar` Component (TDD)

**Goal:** Top navigation bar with a custom SVG logo, Home and Favourites links, and a "Try Free" CTA. Used on the home page.

**Files:**
- Create: `components/Navbar.tsx`
- Create: `tests/unit/Navbar.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/Navbar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Navbar", () => {
  it("renders the brand name", () => {
    render(<Navbar />);
    expect(screen.getByText("Fridge to Table")).toBeInTheDocument();
  });

  it("Home link points to /", () => {
    render(<Navbar />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("Favourites link points to /favourites", () => {
    render(<Navbar />);
    const favLink = screen.getByRole("link", { name: /favourites/i });
    expect(favLink).toHaveAttribute("href", "/favourites");
  });

  it("renders a Try Free call-to-action", () => {
    render(<Navbar />);
    expect(screen.getByText(/try free/i)).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm run test:unit -- --reporter=verbose Navbar
```
Expected: FAIL — "Cannot find module '@/components/Navbar'"

### Step 3: Implement `Navbar`

Create `components/Navbar.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* Fork handle */}
        <rect x="8.25" y="9.5" width="1.5" height="6.5" rx="0.75" fill="white"/>
        {/* Three tines */}
        <rect x="5.5" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        <rect x="8.4" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        <rect x="11.3" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        {/* Tine joiner */}
        <path d="M5.5 8 Q9 9.5 12.5 8" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        {/* Leaf accent */}
        <ellipse cx="4.5" cy="4.5" rx="1.8" ry="2.5" transform="rotate(-30 4.5 4.5)" fill="#D4622A"/>
      </svg>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#1A3A2A] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-white font-semibold text-base tracking-tight">
          <LogoMark />
          <span>Fridge to Table</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Home
          </Link>
          <Link
            href="/favourites"
            className={`text-sm font-medium transition-colors ${
              pathname === "/favourites" ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Favourites
          </Link>
          <Link
            href="/#playground"
            className="bg-[#D4622A] hover:bg-[#BF5525] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Try Free →
          </Link>
        </div>
      </div>
    </nav>
  );
}
```

### Step 4: Run test to verify it passes

```bash
npm run test:unit -- --reporter=verbose Navbar
```
Expected: 4 tests PASS

### Step 5: Commit

```bash
git add components/Navbar.tsx tests/unit/Navbar.test.tsx
git commit -m "feat: add Navbar component with SVG logo and nav links"
```

---

## Task 4: `ClientNav` Component (TDD)

**Goal:** Conditional navigation — renders `Navbar` on `/`, renders `BottomNav` on all other routes.

**Files:**
- Create: `components/ClientNav.tsx`
- Create: `tests/unit/ClientNav.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/ClientNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ClientNav", () => {
  it("shows Navbar (brand name) on the home route", () => {
    vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
    render(<ClientNav />);
    // Navbar renders "Fridge to Table" brand text
    expect(screen.getByText("Fridge to Table")).toBeInTheDocument();
  });

  it("shows BottomNav (Saved tab) on non-home routes", () => {
    vi.mock("next/navigation", () => ({ usePathname: () => "/favourites" }));
    render(<ClientNav />);
    // BottomNav renders "Saved" text
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm run test:unit -- --reporter=verbose ClientNav
```
Expected: FAIL — "Cannot find module '@/components/ClientNav'"

### Step 3: Implement `ClientNav`

Create `components/ClientNav.tsx`:

```tsx
"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

export function ClientNav() {
  const pathname = usePathname();
  if (pathname === "/") return <Navbar />;
  return <BottomNav />;
}
```

### Step 4: Run test to verify it passes

```bash
npm run test:unit -- --reporter=verbose ClientNav
```
Expected: 2 tests PASS

### Step 5: Commit

```bash
git add components/ClientNav.tsx tests/unit/ClientNav.test.tsx
git commit -m "feat: add ClientNav — Navbar on home, BottomNav elsewhere"
```

---

## Task 5: Update `layout.tsx` to Use `ClientNav`

**Goal:** Replace the hard-coded `BottomNav` in the global layout with `ClientNav`.

**Files:**
- Modify: `app/layout.tsx`

### Step 1: Update the import and JSX

In `app/layout.tsx`, make the following changes:

**Remove:**
```tsx
import { BottomNav } from "@/components/BottomNav";
```

**Add:**
```tsx
import { ClientNav } from "@/components/ClientNav";
```

**In the JSX, replace:**
```tsx
{children}
<BottomNav />
```
**With:**
```tsx
{children}
<ClientNav />
```

### Step 2: Run existing unit tests to verify nothing is broken

```bash
npm run test:unit
```
Expected: all existing tests still pass (BottomNav test will still pass because BottomNav itself is unchanged).

### Step 3: Verify visually (dev server)

```bash
npm run dev
```
- Open http://localhost:3000 — should see the dark green top Navbar (no bottom nav)
- Open http://localhost:3000/favourites — should see bottom nav (no top navbar)

### Step 4: Commit

```bash
git add app/layout.tsx
git commit -m "feat: replace global BottomNav with ClientNav in layout"
```

---

## Task 6: Redesign Voice Button in `IngredientInput` (TDD)

**Goal:** Replace the inline 🎙️ emoji mic button with a standalone pill button below the textarea. When recording, it shows animated waveform bars + "Listening... tap to stop" text.

**Files:**
- Modify: `components/IngredientInput.tsx`
- Create: `tests/unit/IngredientInput.test.tsx`

### Step 1: Write the failing test

Create `tests/unit/IngredientInput.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IngredientInput } from "@/components/IngredientInput";

// Mock the voice input lib
vi.mock("@/lib/voiceInput", () => ({
  isVoiceSupported: () => true,
  createSpeechRecognition: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    onstart: null,
    onresult: null,
    onend: null,
    onerror: null,
  }),
}));

describe("IngredientInput — voice button", () => {
  it("shows Speak button when voice is supported", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole("button", { name: /speak/i })).toBeInTheDocument();
  });

  it("does not show the old mic emoji inline in the textarea area", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    // The old button had aria-label "Start voice input"
    expect(screen.queryByLabelText("Start voice input")).not.toBeInTheDocument();
  });

  it("shows Listening text when recording starts", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    const speakBtn = screen.getByRole("button", { name: /speak/i });
    fireEvent.click(speakBtn);
    // After click, the recognition.onstart fires → voiceState = "recording"
    // We check the button changes label
    expect(screen.getByRole("button", { name: /listening|stop/i })).toBeInTheDocument();
  });
});
```

### Step 2: Run test to verify it fails

```bash
npm run test:unit -- --reporter=verbose IngredientInput
```
Expected: FAIL — "Unable to find role='button' with name /speak/i"

### Step 3: Update `IngredientInput` — remove inline emoji, add standalone voice pill

In `components/IngredientInput.tsx`, make these changes:

**A) Remove the inline mic button from inside the textarea's absolute-positioned button row:**

Find and delete this block (lines ~135–149):
```tsx
{/* Voice mic button */}
{voiceSupported && (
  <button
    type="button"
    onClick={handleMicClick}
    aria-label={voiceState === "recording" ? "Stop recording" : "Start voice input"}
    className={`text-xl leading-none transition-colors ${
      voiceState === "recording"
        ? "text-red-500 animate-pulse"
        : "text-gray-400 hover:text-[#D4622A]"
    }`}
  >
    🎙️
  </button>
)}
```

**B) After the closing `</div>` of the textarea block (after the `{!preview && (...)}` block), add the standalone voice button:**

```tsx
{/* Standalone voice button — below textarea, above submit */}
{voiceSupported && !preview && (
  <div className="flex justify-center">
    <button
      type="button"
      onClick={handleMicClick}
      aria-label={voiceState === "recording" ? "Listening, tap to stop" : "Speak your ingredients"}
      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
        voiceState === "recording"
          ? "bg-[#1A3A2A] text-white shadow-lg scale-105"
          : "bg-white border border-gray-200 text-gray-600 hover:border-[#D4622A] hover:text-[#D4622A] shadow-sm"
      }`}
    >
      {voiceState === "recording" ? (
        <>
          {/* Animated waveform bars */}
          <span className="flex items-end gap-0.5 h-4" aria-hidden="true">
            {[0.6, 1.0, 0.8, 1.0, 0.6].map((h, i) => (
              <span
                key={i}
                className="w-0.5 bg-white rounded-full animate-bounce"
                style={{
                  height: `${h * 100}%`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: "0.7s",
                }}
              />
            ))}
          </span>
          <span>Listening... tap to stop</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">🎤</span>
          <span>Speak your ingredients</span>
        </>
      )}
    </button>
  </div>
)}
```

**C) Remove the "Voice not supported" notice** (lines ~154–158) since it adds clutter — the button simply won't appear if unsupported.

### Step 4: Run test to verify it passes

```bash
npm run test:unit -- --reporter=verbose IngredientInput
```
Expected: 3 tests PASS

### Step 5: Run all unit tests

```bash
npm run test:unit
```
Expected: all tests pass.

### Step 6: Commit

```bash
git add components/IngredientInput.tsx tests/unit/IngredientInput.test.tsx
git commit -m "feat: redesign voice button as standalone waveform pill in IngredientInput"
```

---

## Task 7: Add `beforeSubmit` Slot + Move Filters Above Button

**Goal:** `IngredientInput` gains a `beforeSubmit?: React.ReactNode` prop that renders between the voice button and the submit button. `page.tsx` passes `<FiltersPanel>` there (only on the Any Recipe tab).

**Files:**
- Modify: `components/IngredientInput.tsx`
- Modify: `app/page.tsx`

### Step 1: Add the `beforeSubmit` prop to `IngredientInput`

In `components/IngredientInput.tsx`, update the `Props` type:

```typescript
type Props = {
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  beforeSubmit?: React.ReactNode;
};
```

Update the function signature:
```typescript
export function IngredientInput({ onSubmit, isLoading, disabled, beforeSubmit }: Props) {
```

In the JSX, between the voice button block and the submit `<button>`, insert:
```tsx
{/* Slot for content above the submit button (e.g. FiltersPanel) */}
{beforeSubmit}
```

Full relevant section after the change (between voice button and submit button):
```tsx
      {/* beforeSubmit slot */}
      {beforeSubmit}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        ...
      >
```

### Step 2: Update `app/page.tsx` to pass `<FiltersPanel>` as `beforeSubmit`

Find in `app/page.tsx`:
```tsx
        {/* Ingredient input */}
        <IngredientInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={chefsTableDisabled}
        />

        {/* Filters — only on Any Recipe tab */}
        {activeTab === "any-recipe" && (
          <div className="mt-4">
            <FiltersPanel filters={filters} onChange={setFilters} />
          </div>
        )}
```

Replace with:
```tsx
        {/* Ingredient input — filters are passed as beforeSubmit slot */}
        <IngredientInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={chefsTableDisabled}
          beforeSubmit={
            activeTab === "any-recipe" ? (
              <FiltersPanel filters={filters} onChange={setFilters} />
            ) : undefined
          }
        />
```

### Step 3: Verify visually

```bash
npm run dev
```
Open http://localhost:3000. The order should now be:
1. Textarea (ingredient input)
2. Voice button pill
3. Filters (collapsible, "Add filters (optional)")
4. Find Recipes button

Click "Add filters (optional)" to confirm it expands above the button.

### Step 4: Run tests

```bash
npm run test:unit
```
Expected: all tests pass.

### Step 5: Commit

```bash
git add components/IngredientInput.tsx app/page.tsx
git commit -m "feat: add beforeSubmit slot to IngredientInput, move filters above button"
```

---

## Task 8: Landing Page Restructure (`app/page.tsx`)

**Goal:** Transform the home page into a full marketing landing page: Navbar (already handled by ClientNav in layout) → Hero → App Playground (existing tabs + input) → Features Section → Testimonials Section. Also integrates the `LoadingChef` animation.

**Files:**
- Modify: `app/page.tsx`

### Step 1: Replace the entire content of `app/page.tsx`

The file currently has `pb-24` (bottom nav clearance) and a simple div wrapper. Replace everything after the imports with the new landing page layout.

Complete new `app/page.tsx`:

```tsx
"use client";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChefGrid } from "@/components/ChefGrid";
import { LoadingChef } from "@/components/LoadingChef";
import { getSelectedChefs } from "@/lib/chefs";
import type { RecipeFilters } from "@/types/recipe";

type ActiveTab = "any-recipe" | "chefs-table";

const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

const SELECTED_CHEFS_KEY = "fridgeToTable_selectedChefs";

// ─── Feature cards data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    emoji: "📸",
    iconBg: "bg-orange-100",
    title: "Snap, speak, or type",
    body: "Snap a pic or type a short summary or say it out loud.",
  },
  {
    emoji: "👨‍🍳",
    iconBg: "bg-green-100",
    title: "Cook like your idols",
    body: "Recipes inspired by Gordon Ramsay, Jamie Oliver, and more. Real techniques. Your ingredients. One beautiful result.",
  },
  {
    emoji: "🎯",
    iconBg: "bg-yellow-100",
    title: "Any skill, any night",
    body: "Filter from quick weeknight dinners to weekend showstoppers. Every recipe is designed to help you grow.",
  },
  {
    emoji: "✨",
    iconBg: "bg-purple-100",
    title: "Zero ads. Always.",
    body: "We're subscriber-funded. No sponsored recipes. No pop-ups. Just you and the food you love.",
  },
];

// ─── Testimonials data ───────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "I used to stare at my fridge for 20 minutes wondering what to cook. Now I just snap a photo and I've got three delicious options in seconds.",
    author: "Priya M., San Francisco",
  },
  {
    quote:
      "The Chef's Table feature is unreal. Getting Jamie Oliver-inspired recipes from what's actually in my kitchen? Game changer.",
    author: "Jake T., London",
  },
  {
    quote:
      "Finally an app that meets me where I am. I can type, talk, or take a picture — and it always gets it right.",
    author: "Aisha K., Toronto",
  },
];

// ─── Page component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("any-recipe");
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
    if (saved) {
      try {
        setSelectedChefIds(JSON.parse(saved));
      } catch {
        // ignore malformed data
      }
    }
  }, []);

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
        localStorage.setItem("chefTableResults", JSON.stringify(results));
        router.push("/chef-results");
      } else {
        const sessionId = getSessionId();
        const recipeSetId = await generateRecipes({
          sessionId,
          ingredients: finalIngredients,
          filters,
        });
        router.push(`/results/${recipeSetId}`);
      }
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  const chefsTableDisabled = activeTab === "chefs-table" && selectedChefIds.length === 0;

  return (
    <div className="min-h-screen bg-[#FAF6F1]">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="pt-16 pb-10 px-4 text-center">
        <p className="text-xs font-semibold tracking-widest text-[#D4622A] uppercase mb-4">
          AI-Powered Cooking
        </p>
        <h1 className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl font-bold text-[#1A3A2A] leading-tight mb-4">
          What&apos;s in your{" "}
          <em className="text-[#D4622A] not-italic">fridge?</em>
        </h1>
        <p className="text-gray-500 text-base max-w-md mx-auto">
          Tell us your ingredients — we&apos;ll find the perfect recipe.
        </p>
      </section>

      {/* ── APP PLAYGROUND ───────────────────────────────────── */}
      <section id="playground" className="px-4 pb-16">
        <div className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6">

          {/* Tab selector */}
          <div className="flex gap-1 bg-gray-50 rounded-2xl p-1 mb-6">
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

          {/* Chef grid */}
          {activeTab === "chefs-table" && (
            <div className="mb-6">
              <ChefGrid
                selectedIds={selectedChefIds}
                onChange={handleChefSelectionChange}
              />
            </div>
          )}

          {/* Loading animation — replaces input while loading */}
          {isLoading ? (
            <LoadingChef />
          ) : (
            <IngredientInput
              onSubmit={handleSubmit}
              isLoading={isLoading}
              disabled={chefsTableDisabled}
              beforeSubmit={
                activeTab === "any-recipe" ? (
                  <FiltersPanel filters={filters} onChange={setFilters} />
                ) : undefined
              }
            />
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
      </section>

      {/* ── FEATURES SECTION ─────────────────────────────────── */}
      <section className="px-4 py-20 bg-[#FAF6F1]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-[#D4622A] uppercase text-center mb-3">
            Why Fridge to Table
          </p>
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#1A3A2A] text-center mb-12">
            Built around{" "}
            <em className="text-[#D4622A] not-italic">how you cook</em>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className={`w-12 h-12 ${f.iconBg} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {f.emoji}
                </div>
                <h3 className="font-semibold text-[#1A3A2A] text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS SECTION ─────────────────────────────── */}
      <section className="px-4 py-20 bg-[#1A3A2A]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-white text-center mb-2">
            Trusted by{" "}
            <em className="text-[#C9A84C] not-italic">thousands of food lovers</em>
          </h2>
          <p className="text-white/60 text-center text-sm mb-12">
            Enjoy cooking. From easy weeknight dinners to weekend showstoppers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="bg-[#224232] rounded-2xl p-6 border border-white/10"
              >
                <div className="text-[#C9A84C] text-sm mb-3">★★★★★</div>
                <p className="text-white/90 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-white/50 text-xs">— {t.author}</p>
              </div>
            ))}
          </div>

          {/* Rating stat */}
          <div className="text-center mt-12">
            <p className="font-[family-name:var(--font-playfair)] text-6xl font-bold text-white">4.9</p>
            <p className="text-[#C9A84C] text-sm mt-1">★★★★★</p>
            <p className="text-white/50 text-xs mt-1">Average rating from our community</p>
          </div>
        </div>
      </section>

    </div>
  );
}
```

### Step 2: Run unit tests

```bash
npm run test:unit
```
Expected: all tests pass (the page.tsx changes are integration-level, covered by E2E).

### Step 3: Verify visually

```bash
npm run dev
```

Check each section:
- **Navbar:** dark green sticky bar with logo + Home/Favourites/Try Free
- **Hero:** "AI-POWERED COOKING" badge, large serif headline, tagline
- **Playground card:** white rounded card, tabs, input, voice pill, filters above button, loading animation when submitting
- **Features:** cream background, 2×2 grid of cards with colored icon squares
- **Testimonials:** dark green background, 3 quote cards, 4.9 rating

### Step 4: Run E2E smoke test

```bash
npm run test:e2e -- --grep "home"
```
Expected: passing (or acceptable skips for tests that check specific UI text that may have changed — update any that fail due to text changes).

### Step 5: Commit

```bash
git add app/page.tsx
git commit -m "feat: redesign home page as full landing page with hero, features, and testimonials"
```

---

## Final Verification

### Run all tests

```bash
npm run test:unit && npm run test:e2e
```

Expected: all tests pass.

### Build check

```bash
npm run build
```
Expected: no TypeScript or build errors.

### Final commit (if any cleanup needed)

```bash
git add -A
git commit -m "chore: final cleanup after landing page redesign"
```

---

## E2E Test Updates (if needed)

If any E2E tests break because they look for the old hero text or UI structure, update them:

- `tests/e2e/*.spec.ts` — look for tests using `page.getByText("What's in your")` or similar
- The new hero uses `What's in your` + `fridge?` as separate elements — update selectors accordingly

Run: `npm run test:e2e` and fix any selector mismatches before final commit.
