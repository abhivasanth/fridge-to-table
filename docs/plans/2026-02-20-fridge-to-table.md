# Fridge to Table Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a vegetarian recipe suggestion web app where users input fridge ingredients (text or photo) and get 3 personalised recipes with shopping lists.

**Architecture:** Next.js 14 (App Router) as a pure UI layer calling Convex for all server logic. Claude API calls happen exclusively inside Convex Actions. Anonymous sessions via UUID in localStorage identify users without any login.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Convex, Anthropic SDK (`@anthropic-ai/sdk`), Claude `claude-sonnet-4-6`, Vitest, React Testing Library, Playwright, Vercel

---

## Task 1: Scaffold the project

**Files:**
- Create: `package.json` (auto-generated)
- Create: `tailwind.config.ts` (auto-generated)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`

**Step 1: Create the Next.js app**

Run this from inside `fridge_to_table/`:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```
When prompted: accept all defaults. This creates Next.js + TypeScript + Tailwind + ESLint.

Expected output: `Success! Created project at ...`

**Step 2: Install Convex**
```bash
npm install convex
```

**Step 3: Install Anthropic SDK**
```bash
npm install @anthropic-ai/sdk
```

**Step 4: Install testing dependencies**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom convex-test @playwright/test
```

**Step 5: Create Vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    // Unit tests run in jsdom (browser-like environment for React components)
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Separate unit and integration test projects
    projects: [
      {
        name: "unit",
        test: {
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        name: "integration",
        test: {
          include: ["tests/integration/**/*.test.ts"],
          // convex-test requires edge-runtime
          environment: "edge-runtime",
        },
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

**Step 6: Create Vitest setup file**

Create `vitest.setup.ts`:
```typescript
// Adds custom matchers like toBeInTheDocument(), toHaveAttribute(), etc.
import "@testing-library/jest-dom";
```

**Step 7: Create test directories**
```bash
mkdir -p tests/unit tests/integration tests/e2e
```

**Step 8: Add test scripts to package.json**

Open `package.json` and add these entries to the `"scripts"` section:
```json
"test": "vitest run",
"test:unit": "vitest run --project unit",
"test:integration": "vitest run --project integration",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

**Step 9: Verify the dev server starts**
```bash
npm run dev
```
Expected: Server starts on http://localhost:3000 with the default Next.js welcome page.

**Step 10: Commit**
```bash
git add -A
git commit -m "chore: scaffold Next.js project with Convex, Vitest, and Playwright"
```

---

## Task 2: Set up Convex schema and providers

**Files:**
- Create: `convex/schema.ts`
- Create: `types/recipe.ts`
- Create: `components/ConvexClientProvider.tsx`
- Modify: `app/layout.tsx`

**Step 1: Initialise Convex**

Run this in a **separate terminal** and keep it running throughout development:
```bash
npx convex dev
```
Expected: Prompts you to log in (browser opens), creates a Convex project, generates `convex/_generated/` directory, and watches for changes.

This also automatically creates `.env.local` with `NEXT_PUBLIC_CONVEX_URL`.

**Step 2: Write the failing test for schema**

Create `tests/integration/schema.test.ts`:
```typescript
import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import schema from "../../convex/schema";

// Smoke test: verifies the schema is valid and tables can be inserted into
describe("schema", () => {
  test("can insert and retrieve a recipe set", async () => {
    const t = convexTest(schema);

    const id = await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        sessionId: "test-session",
        ingredients: ["eggs", "tomatoes"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });

    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc).not.toBeNull();
    expect(doc!.sessionId).toBe("test-session");
  });

  test("can insert and retrieve a favourite", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        sessionId: "test-session",
        ingredients: [],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });

    const favId = await t.run(async (ctx) => {
      return await ctx.db.insert("favourites", {
        sessionId: "test-session",
        recipeSetId,
        recipeIndex: 0,
        savedAt: Date.now(),
      });
    });

    const fav = await t.run(async (ctx) => ctx.db.get(favId));
    expect(fav!.recipeIndex).toBe(0);
  });
});
```

**Step 3: Run test to verify it fails**
```bash
npm run test:integration
```
Expected: FAIL — `Cannot find module '../../convex/schema'`

**Step 4: Create the Convex schema**

Create `convex/schema.ts`:
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The full database schema for Fridge to Table.
// Two tables: recipes (generated sets) and favourites (saved by user session).
export default defineSchema({
  // Each row stores one "search" — a set of 3 generated recipes for a session.
  recipes: defineTable({
    sessionId: v.string(),            // anonymous user UUID from localStorage
    ingredients: v.array(v.string()), // ingredients the user entered
    filters: v.object({
      cuisine: v.string(),            // free-text e.g. "Italian" or ""
      maxCookingTime: v.number(),     // max cooking time in minutes
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      ),
    }),
    results: v.array(v.any()),        // array of exactly 3 Recipe objects (JSON)
    generatedAt: v.number(),          // Date.now() timestamp
  }),

  // Tracks which recipes a session has saved as favourites.
  favourites: defineTable({
    sessionId: v.string(),
    recipeSetId: v.id("recipes"),     // references the recipes table
    recipeIndex: v.number(),          // 0, 1, or 2 — which of the 3 recipes
    savedAt: v.number(),
  }),
});
```

**Step 5: Run test to verify it passes**
```bash
npm run test:integration
```
Expected: PASS — 2 tests passing

**Step 6: Create the shared Recipe type**

Create `types/recipe.ts`:
```typescript
// Recipe type used in both the frontend (components) and backend (Convex).
// Must be kept in sync with the prompt schema sent to Claude.
export type Recipe = {
  title: string;
  description: string;          // 1-2 sentence hook shown on recipe card
  cookingTime: number;          // estimated cooking time in minutes
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  cuisineType: string;          // e.g. "Italian", "Indian", "Mediterranean"
  ingredients: {
    name: string;
    amount: string;             // e.g. "200g", "3 large", "a handful"
    inFridge: boolean;          // true = user already has this ingredient
  }[];
  steps: string[];              // ordered cooking instructions
  shoppingList: string[];       // ingredients the user needs to buy
  uncertainIngredients?: string[]; // flagged if photo analysis was uncertain
};

// Filters the user can apply when searching for recipes
export type RecipeFilters = {
  cuisine: string;              // free-text — feeds directly into the Claude prompt
  maxCookingTime: number;       // minutes
  difficulty: "easy" | "medium" | "hard";
};
```

**Step 7: Create ConvexClientProvider**

Create `components/ConvexClientProvider.tsx`:
```tsx
"use client";
// Must be a client component — ConvexProvider uses React context and browser APIs
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Initialise the Convex client once. NEXT_PUBLIC_CONVEX_URL is safe to expose
// to the browser — it's just a URL, not a secret key.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 8: Wrap app in ConvexClientProvider**

Replace the contents of `app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fridge to Table",
  description: "Vegetarian recipes from what's in your fridge",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* ConvexClientProvider gives all pages access to the Convex backend */}
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

**Step 9: Verify .env.local exists**
```bash
cat .env.local
```
Expected: `NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud`

If missing, copy the URL from the Convex dashboard and add it manually.

**Step 10: Commit**
```bash
git add -A
git commit -m "feat: set up Convex schema, shared types, and ConvexClientProvider"
```

---

## Task 3: Session ID utility

**Files:**
- Create: `lib/session.ts`
- Create: `tests/unit/session.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/session.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { getSessionId } from "@/lib/session";

describe("getSessionId", () => {
  beforeEach(() => {
    // Clear localStorage before each test to start fresh
    localStorage.clear();
  });

  it("generates a new UUID v4 and stores it on first call", () => {
    const id = getSessionId();
    // UUID v4 format: 8-4-4-4-12 hex characters
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(localStorage.getItem("fridge_session_id")).toBe(id);
  });

  it("returns the same ID on every subsequent call", () => {
    const id1 = getSessionId();
    const id2 = getSessionId();
    expect(id1).toBe(id2);
  });

  it("returns an existing ID from localStorage", () => {
    const existingId = "123e4567-e89b-42d3-a456-426614174000";
    localStorage.setItem("fridge_session_id", existingId);
    expect(getSessionId()).toBe(existingId);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:unit
```
Expected: FAIL — `Cannot find module '@/lib/session'`

**Step 3: Implement session utility**

Create `lib/session.ts`:
```typescript
// Generates a UUID v4 string using Math.random (no external dependencies needed)
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Returns the anonymous session ID for this browser.
// On first visit, generates a new UUID and saves it to localStorage.
// On subsequent visits, returns the stored UUID.
// This ties favourites to a browser without requiring a login.
export function getSessionId(): string {
  const key = "fridge_session_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const newId = generateUUID();
  localStorage.setItem(key, newId);
  return newId;
}
```

**Step 4: Run test to verify it passes**
```bash
npm run test:unit
```
Expected: PASS — 3 tests passing

**Step 5: Commit**
```bash
git add lib/session.ts tests/unit/session.test.ts
git commit -m "feat: add anonymous session ID utility"
```

---

## Task 4: Ingredient text parser

**Files:**
- Create: `lib/ingredientParser.ts`
- Create: `tests/unit/ingredientParser.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/ingredientParser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseIngredients } from "@/lib/ingredientParser";

describe("parseIngredients", () => {
  it("splits comma-separated ingredients into a trimmed array", () => {
    expect(parseIngredients("eggs, milk, butter")).toEqual([
      "eggs",
      "milk",
      "butter",
    ]);
  });

  it("trims extra whitespace from each item", () => {
    expect(parseIngredients("  eggs ,  milk  ,butter")).toEqual([
      "eggs",
      "milk",
      "butter",
    ]);
  });

  it("filters out empty strings caused by double commas or trailing commas", () => {
    expect(parseIngredients("eggs,,milk,")).toEqual(["eggs", "milk"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseIngredients("")).toEqual([]);
  });

  it("handles a single ingredient with no commas", () => {
    expect(parseIngredients("tomatoes")).toEqual(["tomatoes"]);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:unit
```
Expected: FAIL — `Cannot find module '@/lib/ingredientParser'`

**Step 3: Implement ingredient parser**

Create `lib/ingredientParser.ts`:
```typescript
// Converts a comma-separated string of ingredients into a clean array.
// Used to process the text input on the home page.
// Examples:
//   "eggs, milk, butter"  →  ["eggs", "milk", "butter"]
//   "  tomatoes ,,"       →  ["tomatoes"]
export function parseIngredients(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
```

**Step 4: Run test to verify it passes**
```bash
npm run test:unit
```
Expected: PASS — 5 tests passing

**Step 5: Commit**
```bash
git add lib/ingredientParser.ts tests/unit/ingredientParser.test.ts
git commit -m "feat: add ingredient text parser utility"
```

---

## Task 5: Image compression utility

**Files:**
- Create: `lib/imageCompression.ts`
- Create: `tests/unit/imageCompression.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/imageCompression.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressImage } from "@/lib/imageCompression";

// Set up Canvas API mocks — jsdom doesn't implement canvas
const mockDrawImage = vi.fn();
const mockToDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,compressed");
const mockGetContext = vi.fn().mockReturnValue({ drawImage: mockDrawImage });

beforeEach(() => {
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      return {
        getContext: mockGetContext,
        toDataURL: mockToDataURL,
        width: 0,
        height: 0,
      } as unknown as HTMLCanvasElement;
    }
    return document.createElement(tag);
  });
});

describe("compressImage", () => {
  it("rejects if the file is not an image", async () => {
    const file = new File(["text content"], "notes.txt", {
      type: "text/plain",
    });
    await expect(compressImage(file, 1024)).rejects.toThrow(
      "File is not an image"
    );
  });

  it("resolves with a base64 data URL for an image file", async () => {
    const file = new File(["fake jpeg bytes"], "fridge.jpg", {
      type: "image/jpeg",
    });

    // Mock FileReader to simulate file reading
    const mockResult = "data:image/jpeg;base64,fakebytes";
    const mockReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: mockResult,
    };
    vi.stubGlobal(
      "FileReader",
      vi.fn().mockImplementation(() => mockReader)
    );

    // Mock Image to simulate loading with known dimensions
    const mockImg = {
      onload: null as any,
      src: "",
      naturalWidth: 2000,
      naturalHeight: 1500,
    };
    vi.stubGlobal(
      "Image",
      vi.fn().mockImplementation(() => {
        // Trigger onload asynchronously after src is assigned
        setTimeout(() => mockImg.onload?.(), 0);
        return mockImg;
      })
    );

    const promise = compressImage(file, 1024);
    // Trigger the FileReader onload callback
    mockReader.onload?.({ target: { result: mockResult } } as any);

    const result = await promise;
    expect(result).toBe("data:image/jpeg;base64,compressed");
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:unit
```
Expected: FAIL — `Cannot find module '@/lib/imageCompression'`

**Step 3: Implement image compression**

Create `lib/imageCompression.ts`:
```typescript
// Compresses an image File to a maximum width/height in pixels.
// Returns a base64 data URL (JPEG at 85% quality).
//
// WHY: Convex Action arguments have an 8MB limit.
// Phone photos are commonly 4-10MB. We resize to ≤1024px before sending.
// This runs entirely in the browser using the Canvas API — no server round-trip.
export function compressImage(
  file: File,
  maxDimension: number = 1024
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Only process image files
    if (!file.type.startsWith("image/")) {
      reject(new Error("File is not an image"));
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions, preserving the aspect ratio
        let { naturalWidth: width, naturalHeight: height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // Draw the resized image onto an in-memory canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG at 85% quality — good balance of size vs. quality
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };

      img.src = e.target!.result as string;
    };

    reader.readAsDataURL(file);
  });
}
```

**Step 4: Run test to verify it passes**
```bash
npm run test:unit
```
Expected: PASS — 2 tests passing

**Step 5: Commit**
```bash
git add lib/imageCompression.ts tests/unit/imageCompression.test.ts
git commit -m "feat: add client-side image compression utility"
```

---

## Task 6: Convex favourites (mutations and query)

**Files:**
- Create: `convex/favourites.ts`
- Create: `tests/integration/favourites.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/favourites.test.ts`:
```typescript
import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("favourites", () => {
  // Helper: inserts a dummy recipe set and returns its ID
  async function createRecipeSet(t: ReturnType<typeof convexTest>) {
    return await t.run(async (ctx) => {
      return await ctx.db.insert("recipes", {
        sessionId: "session-123",
        ingredients: ["eggs"],
        filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
        results: [],
        generatedAt: Date.now(),
      });
    });
  }

  test("saveFavourite stores a favourite", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      sessionId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      sessionId: "session-123",
    });

    expect(favourites).toHaveLength(1);
    expect(favourites[0].recipeSetId).toBe(recipeSetId);
    expect(favourites[0].recipeIndex).toBe(0);
  });

  test("saveFavourite does not create duplicate entries", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    // Save the same recipe twice
    await t.mutation(api.favourites.saveFavourite, {
      sessionId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });
    await t.mutation(api.favourites.saveFavourite, {
      sessionId: "session-123",
      recipeSetId,
      recipeIndex: 0,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      sessionId: "session-123",
    });
    expect(favourites).toHaveLength(1);
  });

  test("removeFavourite deletes the correct favourite", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      sessionId: "session-123",
      recipeSetId,
      recipeIndex: 1,
    });
    await t.mutation(api.favourites.removeFavourite, {
      sessionId: "session-123",
      recipeSetId,
      recipeIndex: 1,
    });

    const favourites = await t.query(api.favourites.getFavourites, {
      sessionId: "session-123",
    });
    expect(favourites).toHaveLength(0);
  });

  test("getFavourites only returns favourites for the given sessionId", async () => {
    const t = convexTest(schema);
    const recipeSetId = await createRecipeSet(t);

    await t.mutation(api.favourites.saveFavourite, {
      sessionId: "session-A",
      recipeSetId,
      recipeIndex: 0,
    });

    const favouritesB = await t.query(api.favourites.getFavourites, {
      sessionId: "session-B",
    });
    expect(favouritesB).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:integration
```
Expected: FAIL — `api.favourites is not defined`

**Step 3: Implement favourites mutations and query**

Create `convex/favourites.ts`:
```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Saves a recipe to the user's favourites list.
// Silently ignores duplicate saves (idempotent).
export const saveFavourite = mutation({
  args: {
    sessionId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(), // 0, 1, or 2
  },
  handler: async (ctx, args) => {
    // Check for an existing entry to prevent duplicates
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("sessionId"), args.sessionId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (!existing) {
      await ctx.db.insert("favourites", {
        sessionId: args.sessionId,
        recipeSetId: args.recipeSetId,
        recipeIndex: args.recipeIndex,
        savedAt: Date.now(),
      });
    }
  },
});

// Removes a recipe from the user's favourites list.
// Silently ignores if the entry doesn't exist.
export const removeFavourite = mutation({
  args: {
    sessionId: v.string(),
    recipeSetId: v.id("recipes"),
    recipeIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("favourites")
      .filter((q) =>
        q.and(
          q.eq(q.field("sessionId"), args.sessionId),
          q.eq(q.field("recipeSetId"), args.recipeSetId),
          q.eq(q.field("recipeIndex"), args.recipeIndex)
        )
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

// Returns all favourites for a session, sorted most-recently-saved first.
export const getFavourites = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("favourites")
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .order("desc")
      .collect();
  },
});
```

**Step 4: Run test to verify it passes**
```bash
npm run test:integration
```
Expected: PASS — 4 tests passing

**Step 5: Commit**
```bash
git add convex/favourites.ts tests/integration/favourites.test.ts
git commit -m "feat: add Convex favourites save/remove/get functions"
```

---

## Task 7: Convex analyzePhoto action

**Files:**
- Create: `convex/photos.ts`
- Create: `tests/integration/photos.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/photos.test.ts`:
```typescript
import { convexTest } from "convex-test";
import { describe, test, expect, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

// Mock Anthropic SDK — we never make real API calls in tests
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ingredients: ["eggs", "spinach", "milk"],
              uncertain: [],
            }),
          },
        ],
      }),
    },
  })),
}));

describe("analyzePhoto", () => {
  test("extracts ingredients and uncertain list from an image", async () => {
    const t = convexTest(schema);

    const result = await t.action(api.photos.analyzePhoto, {
      imageBase64: "data:image/jpeg;base64,fakebytes",
    });

    expect(result.ingredients).toEqual(["eggs", "spinach", "milk"]);
    expect(result.uncertain).toEqual([]);
  });

  test("returns uncertain ingredients flagged by Claude", async () => {
    const t = convexTest(schema);

    // Override mock for this specific test
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ingredients: ["eggs", "vegetable broth"],
                uncertain: ["vegetable broth"],
              }),
            },
          ],
        }),
      },
    }));

    const result = await t.action(api.photos.analyzePhoto, {
      imageBase64: "data:image/jpeg;base64,fakebytes",
    });

    expect(result.uncertain).toContain("vegetable broth");
    expect(result.ingredients).toContain("vegetable broth");
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:integration
```
Expected: FAIL — `api.photos is not defined`

**Step 3: Implement analyzePhoto action**

Create `convex/photos.ts`:
```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// Analyses a fridge photo using Claude's vision capability.
// The image is NEVER stored — it is sent to Claude and immediately discarded.
// Returns the detected ingredients, with ambiguous ones flagged in `uncertain`.
export const analyzePhoto = action({
  args: {
    // Full base64 data URL, e.g. "data:image/jpeg;base64,/9j/4AAQ..."
    // Compressed to ≤1024px on the client before being sent here.
    imageBase64: v.string(),
  },
  handler: async (
    _ctx,
    args
  ): Promise<{ ingredients: string[]; uncertain: string[] }> => {
    // API key is stored securely in Convex environment variables — never in the browser
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Strip the "data:image/jpeg;base64," prefix — Claude needs only the raw bytes
    const base64Data = args.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mediaTypeMatch = args.imageBase64.match(/data:(image\/\w+);/);
    const mediaType = (mediaTypeMatch?.[1] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data },
            },
            {
              type: "text",
              text: `Analyse this fridge photo for a vegetarian recipe app.
List every food ingredient you can identify.
Assume all ingredients are vegetarian. If something is ambiguous (e.g. could be
meat broth or vegetable broth), assume vegetarian and add it to the uncertain list.
Return JSON only, no other text: { "ingredients": string[], "uncertain": string[] }`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";

    const parsed = JSON.parse(text) as {
      ingredients?: string[];
      uncertain?: string[];
    };

    return {
      ingredients: parsed.ingredients ?? [],
      uncertain: parsed.uncertain ?? [],
    };
  },
});
```

**Step 4: Store Anthropic API key in Convex**
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-YOUR-KEY-HERE
```
Expected: `Set ANTHROPIC_API_KEY`

**Step 5: Run test to verify it passes**
```bash
npm run test:integration
```
Expected: PASS — 2 tests passing (for photos, plus 4 from favourites, plus 2 from schema)

**Step 6: Commit**
```bash
git add convex/photos.ts tests/integration/photos.test.ts
git commit -m "feat: add analyzePhoto Convex action using Claude vision"
```

---

## Task 8: Convex generateRecipes action and getRecipeSet query

**Files:**
- Create: `convex/recipes.ts`
- Create: `tests/integration/recipes.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/recipes.test.ts`:
```typescript
import { convexTest } from "convex-test";
import { describe, test, expect, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import type { Recipe } from "../../types/recipe";

// A minimal valid recipe object matching the Recipe type
const mockRecipe: Recipe = {
  title: "Spinach Omelette",
  description: "A quick, nutritious breakfast.",
  cookingTime: 15,
  difficulty: "easy",
  servings: 2,
  cuisineType: "French",
  ingredients: [
    { name: "eggs", amount: "3 large", inFridge: true },
    { name: "spinach", amount: "handful", inFridge: true },
    { name: "feta", amount: "50g", inFridge: false },
  ],
  steps: ["Beat eggs", "Wilt spinach", "Cook omelette"],
  shoppingList: ["feta"],
};

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            // Claude must return exactly 3 recipes
            text: JSON.stringify([mockRecipe, mockRecipe, mockRecipe]),
          },
        ],
      }),
    },
  })),
}));

describe("generateRecipes", () => {
  test("saves a recipe set to the database and returns its ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      sessionId: "session-abc",
      ingredients: ["eggs", "spinach"],
      filters: { cuisine: "French", maxCookingTime: 30, difficulty: "easy" },
    });

    // Verify the record was written to the database
    const saved = await t.run(async (ctx) => ctx.db.get(recipeSetId));

    expect(saved).not.toBeNull();
    expect(saved!.sessionId).toBe("session-abc");
    expect(saved!.ingredients).toEqual(["eggs", "spinach"]);
    expect(saved!.results).toHaveLength(3);
  });

  test("getRecipeSet returns the saved recipe set by ID", async () => {
    const t = convexTest(schema);

    const recipeSetId = await t.action(api.recipes.generateRecipes, {
      sessionId: "session-xyz",
      ingredients: ["tomatoes", "pasta"],
      filters: { cuisine: "", maxCookingTime: 45, difficulty: "medium" },
    });

    const result = await t.query(api.recipes.getRecipeSet, { recipeSetId });

    expect(result).not.toBeNull();
    expect(result!.results).toHaveLength(3);
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:integration
```
Expected: FAIL — `api.recipes is not defined`

**Step 3: Implement recipes.ts**

Create `convex/recipes.ts`:
```typescript
import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import type { Recipe } from "../types/recipe";

// Internal mutation — saves a generated recipe set to the database.
// "internal" means it cannot be called directly from the browser; only from actions.
export const insertRecipeSet = internalMutation({
  args: {
    sessionId: v.string(),
    ingredients: v.array(v.string()),
    filters: v.object({
      cuisine: v.string(),
      maxCookingTime: v.number(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      ),
    }),
    results: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recipes", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});

// Generates 3 vegetarian recipes from a list of ingredients and filters.
// Calls Claude API, stores the results in Convex, and returns the recipe set ID.
export const generateRecipes = action({
  args: {
    sessionId: v.string(),
    ingredients: v.array(v.string()),
    filters: v.object({
      cuisine: v.string(),
      maxCookingTime: v.number(),
      difficulty: v.union(
        v.literal("easy"),
        v.literal("medium"),
        v.literal("hard")
      ),
    }),
  },
  handler: async (ctx, args) => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const ingredientList = args.ingredients.join(", ");
    const cuisineNote = args.filters.cuisine || "any style";

    // Including the schema in the prompt dramatically improves Claude's JSON reliability
    const recipeSchema = `{
  title: string,
  description: string (1-2 sentences),
  cookingTime: number (minutes),
  difficulty: "easy" | "medium" | "hard",
  servings: number,
  cuisineType: string,
  ingredients: Array<{ name: string, amount: string, inFridge: boolean }>,
  steps: string[],
  shoppingList: string[],
  uncertainIngredients?: string[]
}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a creative vegetarian chef generating recipe suggestions.

The user has these ingredients: ${ingredientList}.
Generate exactly 3 vegetarian recipes using mostly these ingredients.
Cuisine style: ${cuisineNote}.
Maximum cooking time: ${args.filters.maxCookingTime} minutes.
Difficulty level: ${args.filters.difficulty}.

For each recipe:
- Set inFridge: true for ingredients the user already has
- List any additional required ingredients in shoppingList
- If you need to slightly exceed the time or difficulty to give good results,
  do so and briefly note it in the description

Return a JSON array of exactly 3 recipes. No other text. Schema for each recipe:
${recipeSchema}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    const recipes = JSON.parse(text) as Recipe[];

    // Use ctx.runMutation to call the internal mutation from within this action
    const recipeSetId = await ctx.runMutation(internal.recipes.insertRecipeSet, {
      sessionId: args.sessionId,
      ingredients: args.ingredients,
      filters: args.filters,
      results: recipes,
    });

    return recipeSetId;
  },
});

// Retrieves a recipe set by its Convex ID.
// Used by the results page and recipe detail page.
export const getRecipeSet = query({
  args: {
    recipeSetId: v.id("recipes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipeSetId);
  },
});
```

**Step 4: Run test to verify it passes**
```bash
npm run test:integration
```
Expected: PASS — all integration tests passing

**Step 5: Commit**
```bash
git add convex/recipes.ts tests/integration/recipes.test.ts
git commit -m "feat: add generateRecipes action and getRecipeSet query"
```

---

## Task 9: RecipeCard component

**Files:**
- Create: `components/RecipeCard.tsx`
- Create: `tests/unit/RecipeCard.test.tsx`

**Step 1: Write the failing test**

Create `tests/unit/RecipeCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

const mockRecipe: Recipe = {
  title: "Tomato Pasta",
  description: "A simple Italian classic.",
  cookingTime: 20,
  difficulty: "easy",
  servings: 2,
  cuisineType: "Italian",
  ingredients: [
    { name: "pasta", amount: "200g", inFridge: true },
    { name: "parmesan", amount: "30g", inFridge: false },
  ],
  steps: ["Boil pasta", "Make sauce", "Combine"],
  shoppingList: ["parmesan"],
};

describe("RecipeCard", () => {
  it("renders the recipe title", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("Tomato Pasta")).toBeInTheDocument();
  });

  it("renders cooking time", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("20 min")).toBeInTheDocument();
  });

  it("renders difficulty badge", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("easy")).toBeInTheDocument();
  });

  it("renders cuisine type", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    expect(screen.getByText("Italian")).toBeInTheDocument();
  });

  it("links to the correct recipe detail page", () => {
    render(<RecipeCard recipe={mockRecipe} recipeSetId="set-1" recipeIndex={0} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/recipe/set-1/0");
  });
});
```

**Step 2: Run test to verify it fails**
```bash
npm run test:unit
```
Expected: FAIL — `Cannot find module '@/components/RecipeCard'`

**Step 3: Implement RecipeCard**

Create `components/RecipeCard.tsx`:
```tsx
import Link from "next/link";
import type { Recipe } from "@/types/recipe";

// Colour scheme for the difficulty badge on each card
const difficultyColours = {
  easy: "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
};

type RecipeCardProps = {
  recipe: Recipe;
  recipeSetId: string; // the Convex ID of the recipe set
  recipeIndex: number; // 0, 1, or 2 — which recipe in the set
};

// A clickable summary card for a single recipe.
// Clicking navigates to the full recipe detail page.
export function RecipeCard({ recipe, recipeSetId, recipeIndex }: RecipeCardProps) {
  return (
    <Link
      href={`/recipe/${recipeSetId}/${recipeIndex}`}
      className="block group h-full"
    >
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6
                   hover:shadow-md transition-shadow duration-200 h-full flex flex-col"
      >
        {/* Badges row: cuisine type + difficulty */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
            {recipe.cuisineType}
          </span>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColours[recipe.difficulty]}`}
          >
            {recipe.difficulty}
          </span>
        </div>

        {/* Title */}
        <h3
          className="text-lg font-semibold text-gray-900 mb-2
                     group-hover:text-green-700 transition-colors"
        >
          {recipe.title}
        </h3>

        {/* Short description */}
        <p className="text-gray-500 text-sm mb-4 flex-1 line-clamp-2">
          {recipe.description}
        </p>

        {/* Cooking time */}
        <div className="flex items-center gap-1 text-gray-400 text-sm">
          <span>⏱</span>
          <span>{recipe.cookingTime} min</span>
        </div>
      </div>
    </Link>
  );
}
```

**Step 4: Run test to verify it passes**
```bash
npm run test:unit
```
Expected: PASS — all unit tests passing

**Step 5: Commit**
```bash
git add components/RecipeCard.tsx tests/unit/RecipeCard.test.tsx
git commit -m "feat: add RecipeCard component"
```

---

## Task 10: Home page

**Files:**
- Create: `components/IngredientInput.tsx`
- Create: `components/FiltersPanel.tsx`
- Modify: `app/page.tsx`

**Step 1: Create IngredientInput component**

Create `components/IngredientInput.tsx`:
```tsx
"use client";
import { useState } from "react";
import { parseIngredients } from "@/lib/ingredientParser";
import { compressImage } from "@/lib/imageCompression";

type Props = {
  // Called when the user clicks "Find Recipes"
  // ingredients: parsed text list OR empty array (if photo mode — action will extract them)
  // imageBase64: only present when photo mode is used
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
};

// Handles both text input (comma-separated list) and photo upload.
export function IngredientInput({ onSubmit, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState<"text" | "photo">("text");
  const [textInput, setTextInput] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      // Compress before storing — keeps payload within Convex's 8MB limit
      const compressed = await compressImage(file, 1024);
      setPhotoBase64(compressed);
      setPhotoPreview(compressed);
    } catch {
      setPhotoError("Couldn't read that image — please try another.");
    }
  }

  function handleSubmit() {
    if (activeTab === "text") {
      const ingredients = parseIngredients(textInput);
      if (ingredients.length === 0) return;
      onSubmit(ingredients);
    } else {
      if (!photoBase64) return;
      // In photo mode, pass empty ingredients array — the analyzePhoto action extracts them
      onSubmit([], photoBase64);
    }
  }

  const canSubmit =
    !isLoading &&
    (activeTab === "text"
      ? parseIngredients(textInput).length > 0
      : photoBase64 !== null);

  return (
    <div className="w-full max-w-xl">
      {/* Tab toggle */}
      <div className="flex rounded-xl border border-gray-200 mb-4 overflow-hidden">
        {(["text", "photo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${activeTab === tab
                ? "bg-green-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
          >
            {tab === "text" ? "Type ingredients" : "Upload photo"}
          </button>
        ))}
      </div>

      {/* Text input */}
      {activeTab === "text" && (
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="e.g. eggs, spinach, tomatoes, feta cheese..."
          rows={4}
          className="w-full rounded-xl border border-gray-200 p-4 text-gray-800
                     placeholder:text-gray-400 focus:outline-none focus:ring-2
                     focus:ring-green-500 resize-none"
        />
      )}

      {/* Photo upload */}
      {activeTab === "photo" && (
        <div>
          <label
            htmlFor="photo-upload"
            className="flex flex-col items-center justify-center w-full h-48
                       border-2 border-dashed border-gray-300 rounded-xl
                       cursor-pointer hover:border-green-400 hover:bg-green-50
                       transition-colors bg-gray-50 overflow-hidden"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Your fridge"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <p className="text-4xl mb-2">📸</p>
                <p className="text-gray-500 text-sm">
                  Click or drag to upload your fridge photo
                </p>
              </div>
            )}
          </label>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photoError && (
            <p className="text-red-500 text-sm mt-2">{photoError}</p>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 w-full py-3 rounded-xl font-semibold text-white
                   bg-green-600 hover:bg-green-700 disabled:opacity-40
                   disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Finding recipes..." : "Find Recipes"}
      </button>
    </div>
  );
}
```

**Step 2: Create FiltersPanel component**

Create `components/FiltersPanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { RecipeFilters } from "@/types/recipe";

type Props = {
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
};

// Collapsible panel for optional search filters.
// Cuisine is free-text — it feeds directly into the Claude prompt as natural language.
export function FiltersPanel({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-xl">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-gray-400 hover:text-green-700 flex items-center gap-1 transition-colors"
      >
        <span>{open ? "▲" : "▼"}</span>
        <span>{open ? "Hide filters" : "Add filters (optional)"}</span>
      </button>

      {open && (
        <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-4 border border-gray-100">
          {/* Cuisine mood */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Cuisine / mood
            </label>
            <input
              type="text"
              value={filters.cuisine}
              onChange={(e) => onChange({ ...filters, cuisine: e.target.value })}
              placeholder='e.g. Italian, spicy, comfort food, "impress guests"'
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Max cooking time */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Max cooking time
            </label>
            <div className="flex gap-2">
              {([15, 30, 45, 60] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...filters, maxCookingTime: t })}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${filters.maxCookingTime === t
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                    }`}
                >
                  {t === 60 ? "60+ m" : `${t} m`}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ ...filters, difficulty: d })}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors
                    ${filters.difficulty === d
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 3: Replace the home page**

Replace the entire contents of `app/page.tsx` with:
```tsx
"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import type { RecipeFilters } from "@/types/recipe";

// Default filters used when the user doesn't open the filters panel
const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

export default function HomePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex actions — these run server-side in Convex, calling Claude
  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    setIsLoading(true);
    setError(null);

    try {
      let finalIngredients = ingredients;

      // Photo mode: use Claude vision to extract ingredients from the image first
      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });

        if (photoResult.ingredients.length === 0) {
          setError(
            "We couldn't detect many ingredients — try typing them instead."
          );
          setIsLoading(false);
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      // Generate 3 recipes and navigate to the results page
      const recipeSetId = await generateRecipes({
        sessionId: getSessionId(),
        ingredients: finalIngredients,
        filters,
      });

      router.push(`/results/${recipeSetId}`);
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🥦 Fridge to Table
          </h1>
          <p className="text-gray-500 text-lg">
            Tell us what&apos;s in your fridge — we&apos;ll find something delicious.
          </p>
        </div>

        {/* Ingredient input (text or photo) */}
        <IngredientInput onSubmit={handleSubmit} isLoading={isLoading} />

        {/* Optional filters */}
        <FiltersPanel filters={filters} onChange={setFilters} />

        {/* Error message */}
        {error && (
          <div className="w-full max-w-xl bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center">
            <p className="text-5xl animate-bounce">👨‍🍳</p>
            <p className="text-gray-400 mt-2 text-sm">
              Finding your recipes...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
```

**Step 4: Verify the page renders**
```bash
npm run dev
```
Open http://localhost:3000. Expected: home page with tab toggle, textarea, "Add filters" toggle, and disabled "Find Recipes" button.

**Step 5: Commit**
```bash
git add app/page.tsx components/IngredientInput.tsx components/FiltersPanel.tsx
git commit -m "feat: add home page with ingredient input and filters"
```

---

## Task 11: Results page

**Files:**
- Create: `app/results/[recipeSetId]/page.tsx`

**Step 1: Create the directory and page**

```bash
mkdir -p app/results/\[recipeSetId\]
```

Create `app/results/[recipeSetId]/page.tsx`:
```tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { RecipeCard } from "@/components/RecipeCard";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: { recipeSetId: string };
};

// Server component — fetches data before rendering (no loading spinner needed)
export default async function ResultsPage({ params }: Props) {
  const recipeSet = await fetchQuery(api.recipes.getRecipeSet, {
    recipeSetId: params.recipeSetId as Id<"recipes">,
  });

  if (!recipeSet) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Recipe set not found.</p>
          <Link href="/" className="text-green-600 underline">
            Start a new search
          </Link>
        </div>
      </main>
    );
  }

  const recipes = recipeSet.results as Recipe[];

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-green-600 text-sm hover:underline mb-4 inline-block"
          >
            ← New search
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            Here&apos;s what we found
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Based on: {recipeSet.ingredients.join(", ")}
          </p>
        </div>

        {/* 3 recipe cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={index}
              recipe={recipe}
              recipeSetId={params.recipeSetId}
              recipeIndex={index}
            />
          ))}
        </div>

        {/* Link to favourites */}
        <div className="mt-10 text-center">
          <Link
            href="/favourites"
            className="text-gray-400 text-sm hover:text-green-600 transition-colors"
          >
            View saved favourites →
          </Link>
        </div>
      </div>
    </main>
  );
}
```

**Step 2: Verify manually**

With `npx convex dev` and `npm run dev` both running:
1. Go to http://localhost:3000
2. Type: `eggs, spinach, tomatoes`
3. Click Find Recipes
4. Expected: redirects to `/results/[id]` showing 3 recipe cards

**Step 3: Commit**
```bash
git add app/results/
git commit -m "feat: add results page showing 3 recipe cards"
```

---

## Task 12: Recipe detail page

**Files:**
- Create: `components/FavouriteButton.tsx`
- Create: `app/recipe/[recipeSetId]/[recipeIndex]/page.tsx`

**Step 1: Create FavouriteButton client component**

Create `components/FavouriteButton.tsx`:
```tsx
"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  recipeSetId: string;
  recipeIndex: number;
};

// Heart button that toggles a recipe's saved state.
// Uses Convex's real-time query — the button updates instantly after clicking.
export function FavouriteButton({ recipeSetId, recipeIndex }: Props) {
  const sessionId = getSessionId();
  const favourites = useQuery(api.favourites.getFavourites, { sessionId });
  const saveFavourite = useMutation(api.favourites.saveFavourite);
  const removeFavourite = useMutation(api.favourites.removeFavourite);

  const isFavourited = favourites?.some(
    (f) => f.recipeSetId === recipeSetId && f.recipeIndex === recipeIndex
  );

  async function handleToggle() {
    const id = recipeSetId as Id<"recipes">;
    if (isFavourited) {
      await removeFavourite({ sessionId, recipeSetId: id, recipeIndex });
    } else {
      await saveFavourite({ sessionId, recipeSetId: id, recipeIndex });
    }
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={isFavourited ? "Remove from favourites" : "Save to favourites"}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                  border transition-colors
                  ${
                    isFavourited
                      ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                      : "bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
                  }`}
    >
      <span>{isFavourited ? "♥" : "♡"}</span>
      <span>{isFavourited ? "Saved" : "Save to Favourites"}</span>
    </button>
  );
}
```

**Step 2: Create recipe detail page**

```bash
mkdir -p "app/recipe/[recipeSetId]/[recipeIndex]"
```

Create `app/recipe/[recipeSetId]/[recipeIndex]/page.tsx`:
```tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { FavouriteButton } from "@/components/FavouriteButton";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: { recipeSetId: string; recipeIndex: string };
};

export default async function RecipeDetailPage({ params }: Props) {
  const recipeSet = await fetchQuery(api.recipes.getRecipeSet, {
    recipeSetId: params.recipeSetId as Id<"recipes">,
  });

  const recipeIndex = parseInt(params.recipeIndex, 10);
  const recipe = recipeSet
    ? (recipeSet.results as Recipe[])[recipeIndex]
    : null;

  if (!recipe) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">
          Recipe not found.{" "}
          <Link href="/" className="text-green-600 underline">
            Go home
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Back link */}
        <Link
          href={`/results/${params.recipeSetId}`}
          className="text-green-600 text-sm hover:underline mb-6 inline-block"
        >
          ← Back to results
        </Link>

        {/* Uncertainty notice — shown only if photo analysis flagged items */}
        {recipe.uncertainIngredients && recipe.uncertainIngredients.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
            <strong>Note:</strong> We assumed these were vegetarian but weren&apos;t
            certain: {recipe.uncertainIngredients.join(", ")}. Double-check
            before cooking!
          </div>
        )}

        {/* Title and favourite button */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{recipe.title}</h1>
          <FavouriteButton
            recipeSetId={params.recipeSetId}
            recipeIndex={recipeIndex}
          />
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 mb-6 text-sm">
          <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full font-medium">
            {recipe.cuisineType}
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            ⏱ {recipe.cookingTime} min
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            👤 {recipe.servings} servings
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full capitalize">
            {recipe.difficulty}
          </span>
        </div>

        <p className="text-gray-600 mb-8">{recipe.description}</p>

        {/* Ingredients list */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Ingredients
          </h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center
                    text-xs flex-shrink-0
                    ${ing.inFridge
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {ing.inFridge ? "✓" : "○"}
                </span>
                <span
                  className={ing.inFridge ? "text-gray-800" : "text-gray-400"}
                >
                  <strong>{ing.amount}</strong> {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Step-by-step instructions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Instructions
          </h2>
          <ol className="space-y-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4 text-sm text-gray-700">
                <span
                  className="w-7 h-7 rounded-full bg-green-600 text-white font-bold
                             flex items-center justify-center flex-shrink-0 text-xs"
                >
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Shopping list — only shown if there are items to buy */}
        {recipe.shoppingList.length > 0 && (
          <section className="bg-amber-50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              🛒 Shopping List
            </h2>
            <ul className="space-y-1">
              {recipe.shoppingList.map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-700 flex items-center gap-2"
                >
                  <span className="text-amber-500">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
```

**Step 3: Verify manually**

Navigate from the results page to a recipe card. Expected:
- Full recipe detail with ingredients (ticked/unticked), numbered steps, shopping list
- Heart button — click it, it turns red and says "Saved"
- Click again — it reverts to "Save to Favourites"

**Step 4: Commit**
```bash
git add components/FavouriteButton.tsx "app/recipe/"
git commit -m "feat: add recipe detail page with FavouriteButton"
```

---

## Task 13: Favourites page

**Files:**
- Create: `components/FavouritesGrid.tsx`
- Create: `app/favourites/page.tsx`

**Step 1: Create FavouritesGrid client component**

Create `components/FavouritesGrid.tsx`:
```tsx
"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

// Loads and renders the user's saved recipes.
// Uses Convex's real-time query — removes appear instantly without a page refresh.
export function FavouritesGrid() {
  const sessionId = getSessionId();
  // `undefined` while loading, `[]` when loaded but empty
  const favourites = useQuery(api.favourites.getFavourites, { sessionId });
  const removeFavourite = useMutation(api.favourites.removeFavourite);

  if (favourites === undefined) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl animate-pulse">🥦</p>
        <p className="text-gray-400 mt-2">Loading your favourites...</p>
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🍽️</p>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No favourites yet
        </h3>
        <p className="text-gray-400 mb-6">Save recipes you love while cooking!</p>
        <Link
          href="/"
          className="inline-block bg-green-600 text-white px-6 py-3 rounded-xl
                     font-medium hover:bg-green-700 transition-colors"
        >
          Find recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {favourites.map((fav) => (
        <FavouriteCard
          key={fav._id}
          recipeSetId={fav.recipeSetId}
          recipeIndex={fav.recipeIndex}
          onRemove={() =>
            removeFavourite({
              sessionId,
              recipeSetId: fav.recipeSetId as Id<"recipes">,
              recipeIndex: fav.recipeIndex,
            })
          }
        />
      ))}
    </div>
  );
}

// Individual card that fetches its own recipe data from Convex
function FavouriteCard({
  recipeSetId,
  recipeIndex,
  onRemove,
}: {
  recipeSetId: string;
  recipeIndex: number;
  onRemove: () => void;
}) {
  const recipeSet = useQuery(api.recipes.getRecipeSet, {
    recipeSetId: recipeSetId as Id<"recipes">,
  });

  if (!recipeSet) return null;

  const recipe = (recipeSet.results as Recipe[])[recipeIndex];
  if (!recipe) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      {/* Remove button */}
      <button
        onClick={onRemove}
        aria-label="Remove from favourites"
        className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors text-lg"
      >
        ♥
      </button>

      <Link href={`/recipe/${recipeSetId}/${recipeIndex}`}>
        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
          {recipe.cuisineType}
        </span>
        <h3 className="text-base font-semibold text-gray-900 mt-2 mb-1 hover:text-green-700 transition-colors">
          {recipe.title}
        </h3>
        <p className="text-gray-400 text-xs">⏱ {recipe.cookingTime} min</p>
      </Link>
    </div>
  );
}
```

**Step 2: Create favourites page**

```bash
mkdir -p app/favourites
```

Create `app/favourites/page.tsx`:
```tsx
import { FavouritesGrid } from "@/components/FavouritesGrid";
import Link from "next/link";

export default function FavouritesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-green-600 text-sm hover:underline mb-4 inline-block"
          >
            ← Back to search
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Your Favourites</h1>
          <p className="text-gray-400 text-sm mt-1">
            Recipes you&apos;ve saved this session
          </p>
        </div>
        <FavouritesGrid />
      </div>
    </main>
  );
}
```

**Step 3: Verify manually**

1. Save a recipe from the detail page
2. Navigate to http://localhost:3000/favourites
3. Expected: saved recipe card appears
4. Click the ♥ remove button — card disappears instantly (real-time Convex update)

**Step 4: Commit**
```bash
git add components/FavouritesGrid.tsx app/favourites/
git commit -m "feat: add favourites page with real-time remove"
```

---

## Task 14: Playwright E2E tests

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/text-input.spec.ts`
- Create: `tests/e2e/favourites.spec.ts`

**Step 1: Write the failing tests first**

Create `playwright.config.ts`:
```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  // Starts the dev server automatically before tests run
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

Create `tests/e2e/text-input.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

// These tests make real calls to Convex and Claude API.
// Ensure npx convex dev is running and ANTHROPIC_API_KEY is set in Convex env.

test("Find Recipes button is disabled when no ingredients are entered", async ({
  page,
}) => {
  await page.goto("/");
  const button = page.getByRole("button", { name: "Find Recipes" });
  await expect(button).toBeDisabled();
});

test("typing ingredients enables the Find Recipes button", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/e.g. eggs/).fill("eggs, spinach");
  const button = page.getByRole("button", { name: "Find Recipes" });
  await expect(button).toBeEnabled();
});

test("submitting ingredients shows 3 recipe cards on results page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByPlaceholder(/e.g. eggs/).fill("eggs, spinach, tomatoes");
  await page.getByRole("button", { name: "Find Recipes" }).click();

  // Claude API may take up to 30 seconds — use a generous timeout
  await page.waitForURL(/\/results\//, { timeout: 30_000 });

  const recipeLinks = page.locator("a[href*='/recipe/']");
  await expect(recipeLinks).toHaveCount(3, { timeout: 5_000 });
});
```

Create `tests/e2e/favourites.spec.ts`:
```typescript
import { test, expect } from "@playwright/test";

test("user can save and remove a favourite recipe", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/e.g. eggs/).fill("pasta, tomatoes, basil");
  await page.getByRole("button", { name: "Find Recipes" }).click();

  await page.waitForURL(/\/results\//, { timeout: 30_000 });

  // Click the first recipe card
  await page.locator("a[href*='/recipe/']").first().click();
  await page.waitForURL(/\/recipe\//);

  // Save to favourites
  await page.getByRole("button", { name: /save to favourites/i }).click();
  await expect(page.getByRole("button", { name: /saved/i })).toBeVisible();

  // Go to favourites page and verify the recipe is there
  await page.goto("/favourites");
  await expect(page.locator("a[href*='/recipe/']")).toHaveCount(1);

  // Remove the favourite
  await page.getByRole("button", { name: /remove from favourites/i }).click();
  await expect(page.getByText("No favourites yet")).toBeVisible();
});
```

**Step 2: Install Playwright browsers**
```bash
npx playwright install chromium
```
Expected: Downloads Chromium browser for testing

**Step 3: Run E2E tests**

Make sure `npx convex dev` is running in a separate terminal, then:
```bash
npm run test:e2e
```
Expected: All 4 tests pass. (Tests make real Claude API calls — allow up to 60 seconds.)

**Step 4: Commit**
```bash
git add playwright.config.ts tests/e2e/
git commit -m "test: add Playwright E2E tests for core user flows"
```

---

## Task 15: Deploy to Vercel

**Step 1: Push repo to GitHub**

Go to https://github.com/new and create a new repository called `fridge-to-table`.

Then:
```bash
git remote add origin https://github.com/YOUR-USERNAME/fridge-to-table.git
git push -u origin main
```

**Step 2: Import to Vercel**

Go to https://vercel.com/new, click "Import Git Repository", and select `fridge-to-table`.

In the "Environment Variables" section, add:
```
NEXT_PUBLIC_CONVEX_URL = <paste value from your .env.local file>
```

Click Deploy.

**Step 3: Point Convex to production**
```bash
npx convex deploy
```
Expected: `Deployed Convex functions to production`

**Step 4: Set ANTHROPIC_API_KEY in Convex production**
```bash
npx convex env set ANTHROPIC_API_KEY sk-ant-YOUR-KEY-HERE --prod
```

**Step 5: Verify production**

Open your Vercel URL (e.g. `https://fridge-to-table.vercel.app`), enter ingredients, and verify 3 recipes are returned.

**Step 6: Final commit**
```bash
git add -A
git commit -m "chore: production deployment verified"
```

---

## Quick Reference: Commands

| Purpose | Command |
|---|---|
| Start dev server | `npm run dev` |
| Start Convex (separate terminal) | `npx convex dev` |
| Run all unit tests | `npm run test:unit` |
| Run all integration tests | `npm run test:integration` |
| Run all tests | `npm test` |
| Run E2E tests | `npm run test:e2e` |
| Deploy Convex | `npx convex deploy` |
| Set Convex env var | `npx convex env set KEY value` |
