# Editable Chef Roster Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify default and custom chefs into a manageable roster on My Chefs, letting users pick up to 8 to appear on the Chef's Table grid.

**Architecture:** New `lib/chefSlots.ts` manages localStorage slot selection. `ChefGrid` accepts a `ChefSlot[]` prop instead of reading hardcoded `CHEFS`. My Chefs page shows two sections (Featured + Your Chefs) with checkmark toggles. No backend/schema changes needed.

**Tech Stack:** Next.js 15, React, Convex, Tailwind CSS, localStorage

**Design doc:** `docs/plans/2026-03-08-editable-chef-roster-design.md`

---

### Task 1: Create `ChefSlot` type and adapter functions in `lib/chefs.ts`

**Files:**
- Modify: `lib/chefs.ts`

**Step 1: Add `ChefSlot` type and adapters below existing code**

Add to end of `lib/chefs.ts`:

```ts
// Unified type for Chef's Table grid — normalizes default and custom chefs.
export type ChefSlot = {
  id: string;                    // default: "gordon-ramsay", custom: channelId
  name: string;
  youtubeChannelId: string;
  isDefault: boolean;
  emoji: string;                 // defaults have unique emoji, customs get "👨‍🍳"
  country?: string;              // only defaults
  thumbnail?: string;            // YouTube avatar URL — only custom
};

export const DEFAULT_CHEF_IDS = CHEFS.map((c) => c.id);

export function defaultToSlot(chef: Chef): ChefSlot {
  return {
    id: chef.id,
    name: chef.name,
    youtubeChannelId: chef.youtubeChannelId,
    isDefault: true,
    emoji: chef.emoji,
    country: chef.country,
  };
}

export type CustomChefData = {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
};

export function customToSlot(chef: CustomChefData): ChefSlot {
  return {
    id: chef.channelId,
    name: chef.channelName,
    youtubeChannelId: chef.channelId,
    isDefault: false,
    emoji: "👨‍🍳",
    thumbnail: chef.channelThumbnail,
  };
}
```

**Step 2: Update `getSelectedChefs` to work with `ChefSlot[]`**

Replace the existing `getSelectedChefs` function:

```ts
// Returns ChefSlots matching the given IDs from a merged list.
export function getSelectedChefs(ids: string[]): Chef[] {
  return CHEFS.filter((chef) => ids.includes(chef.id));
}

export function getSelectedSlots(ids: string[], allSlots: ChefSlot[]): ChefSlot[] {
  return allSlots.filter((slot) => ids.includes(slot.id));
}
```

Keep the old `getSelectedChefs` for now (removed in Task 5 when page.tsx is updated).

**Step 3: Commit**

```bash
git add lib/chefs.ts
git commit -m "feat: add ChefSlot type and adapter functions"
```

---

### Task 2: Create `lib/chefSlots.ts` — slot management utilities

**Files:**
- Create: `lib/chefSlots.ts`

**Step 1: Create the file**

```ts
// lib/chefSlots.ts
// Manages which chefs appear on the Chef's Table grid (max 8).
// Stored in localStorage. Defaults to all 8 built-in chefs on first visit.
import { DEFAULT_CHEF_IDS } from "@/lib/chefs";

const SLOT_KEY = "fridgeToTable_chefTableSlots";
export const MAX_CHEF_TABLE_SLOTS = 8;

export function getSlotIds(): string[] {
  if (typeof window === "undefined") return DEFAULT_CHEF_IDS;
  const stored = localStorage.getItem(SLOT_KEY);
  if (!stored) return DEFAULT_CHEF_IDS;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : DEFAULT_CHEF_IDS;
  } catch {
    return DEFAULT_CHEF_IDS;
  }
}

export function setSlotIds(ids: string[]): void {
  localStorage.setItem(SLOT_KEY, JSON.stringify(ids));
}

// Remove stale IDs from per-search selection that aren't in current slots.
export function validateSelectedChefs(selectedIds: string[], slotIds: string[]): string[] {
  return selectedIds.filter((id) => slotIds.includes(id));
}
```

**Step 2: Commit**

```bash
git add lib/chefSlots.ts
git commit -m "feat: add chefSlots utility for slot management"
```

---

### Task 3: Update `ChefGrid` to accept `ChefSlot[]` and add "Edit chefs" link

**Files:**
- Modify: `components/ChefGrid.tsx`

**Step 1: Rewrite `ChefGrid.tsx`**

Replace entire file:

```tsx
"use client";
// Multi-select grid of chefs for the Chef's Table tab.
// Renders default chefs with emoji, custom chefs with thumbnail.
import Link from "next/link";
import type { ChefSlot } from "@/lib/chefs";

type Props = {
  chefs: ChefSlot[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ChefGrid({ chefs, selectedIds, onChange }: Props) {
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
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="text-xs text-[#D4622A] font-medium">
              {selectedIds.length} selected
            </span>
          )}
          <Link
            href="/my-chefs"
            className="text-xs text-[#D4622A] font-medium hover:underline"
          >
            Edit chefs
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {chefs.map((chef) => {
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
              {chef.thumbnail ? (
                <img
                  src={chef.thumbnail}
                  alt={chef.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="text-2xl flex-shrink-0">{chef.emoji}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A3A2A] truncate">{chef.name}</p>
                {chef.country && (
                  <p className="text-xs text-gray-400">{chef.country}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {chefs.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 mb-2">No chefs selected for Chef&apos;s Table</p>
          <Link href="/my-chefs" className="text-xs text-[#D4622A] font-medium hover:underline">
            Add chefs
          </Link>
        </div>
      )}
      {chefs.length > 0 && selectedIds.length === 0 && (
        <p className="text-xs text-gray-400 text-center pt-1">
          Select at least one chef to search
        </p>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/ChefGrid.tsx
git commit -m "feat: ChefGrid accepts ChefSlot[], adds Edit chefs link"
```

---

### Task 4: Update `app/page.tsx` to use slots and merged chef list

**Files:**
- Modify: `app/page.tsx`

**Step 1: Update imports (lines 1-13)**

Replace:
```ts
import { getSelectedChefs } from "@/lib/chefs";
```
With:
```ts
import { CHEFS, defaultToSlot, customToSlot, getSelectedSlots } from "@/lib/chefs";
import type { ChefSlot } from "@/lib/chefs";
import { getSlotIds, validateSelectedChefs } from "@/lib/chefSlots";
import { useQuery } from "convex/react";
import { getSessionId } from "@/lib/session";
```

Note: `useAction` is already imported. Add `useQuery` to the existing import from `"convex/react"`:
```ts
import { useAction, useQuery } from "convex/react";
```

**Step 2: Add custom chef fetching and slot logic inside `HomePage` (after line 117)**

Add after state declarations:

```ts
const sessionId = getSessionId();
const customChefsRaw = useQuery(
  api.customChefs.listCustomChefs,
  sessionId ? { sessionId } : "skip"
) ?? [];

// Build merged chef list: defaults (always) + customs
const allSlots: ChefSlot[] = [
  ...CHEFS.map(defaultToSlot),
  ...customChefsRaw.map(customToSlot),
];

// Which chefs appear on Chef's Table (max 8, from My Chefs page)
const [chefTableSlotIds, setChefTableSlotIds] = useState<string[]>([]);

useEffect(() => {
  if (typeof window === "undefined") return;
  setChefTableSlotIds(getSlotIds());
}, []);

const visibleChefs = allSlots.filter((s) => chefTableSlotIds.includes(s.id));
```

**Step 3: Update the existing `selectedChefIds` useEffect (lines 119-129)**

Replace the existing useEffect that reads `SELECTED_CHEFS_KEY`:
```ts
useEffect(() => {
  if (typeof window === "undefined") return;
  const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const slots = getSlotIds();
      setSelectedChefIds(validateSelectedChefs(parsed, slots));
    } catch {
      // ignore malformed data
    }
  }
}, []);
```

**Step 4: Update the search flow (lines 156-165)**

Replace `getSelectedChefs(selectedChefIds)` with slot-aware version:
```ts
if (activeTab === "chefs-table") {
  const selectedSlots = getSelectedSlots(selectedChefIds, visibleChefs);
  const results = await searchChefVideos({
    ingredients: finalIngredients,
    chefs: selectedSlots.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      youtubeChannelId: c.youtubeChannelId,
    })),
  });
```

**Step 5: Update ChefGrid usage (lines 282-287)**

Replace:
```tsx
<ChefGrid
  selectedIds={selectedChefIds}
  onChange={handleChefSelectionChange}
/>
```
With:
```tsx
<ChefGrid
  chefs={visibleChefs}
  selectedIds={selectedChefIds}
  onChange={handleChefSelectionChange}
/>
```

**Step 6: Remove unused import**

Remove: `import { getSelectedChefs } from "@/lib/chefs";` (line 12)

**Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: home page uses slot system for Chef's Table grid"
```

---

### Task 5: Redesign `app/my-chefs/page.tsx` with two sections and checkmark toggles

**Files:**
- Modify: `app/my-chefs/page.tsx`

**Step 1: Rewrite the entire page**

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { CHEFS, DEFAULT_CHEF_IDS } from "@/lib/chefs";
import { getSlotIds, setSlotIds, MAX_CHEF_TABLE_SLOTS } from "@/lib/chefSlots";
import { CustomChefCard } from "@/components/CustomChefCard";

const MAX_CUSTOM_CHEFS = 6;

type PreviewChef = {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  resolvedAt: number;
};

type ResolveError = "parse_error" | "not_found" | "api_error" | null;

const RESOLVE_ERROR_MESSAGES: Record<NonNullable<ResolveError>, string> = {
  parse_error: "Paste a YouTube channel URL or @handle",
  not_found: "We couldn't find that channel — check the URL",
  api_error: "Something went wrong — try again",
};

export default function MyChefsMPage() {
  const sessionId = getSessionId();
  const customChefs =
    useQuery(
      api.customChefs.listCustomChefs,
      sessionId ? { sessionId } : "skip"
    ) ?? [];

  const addCustomChef = useMutation(api.customChefs.addCustomChef);
  const removeCustomChef = useMutation(api.customChefs.removeCustomChef);
  const resolveYouTubeChannel = useAction(api.customChefs.resolveYouTubeChannel);

  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PreviewChef | null>(null);
  const [resolveError, setResolveError] = useState<ResolveError>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [slotIds, setSlotIdsState] = useState<string[]>([]);
  const [slotWarning, setSlotWarning] = useState(false);

  useEffect(() => {
    setSlotIdsState(getSlotIds());
  }, []);

  const atCustomLimit = customChefs.length >= MAX_CUSTOM_CHEFS;

  function toggleSlot(id: string) {
    setSlotWarning(false);
    if (slotIds.includes(id)) {
      const next = slotIds.filter((s) => s !== id);
      setSlotIdsState(next);
      setSlotIds(next);
    } else {
      if (slotIds.length >= MAX_CHEF_TABLE_SLOTS) {
        setSlotWarning(true);
        return;
      }
      const next = [...slotIds, id];
      setSlotIdsState(next);
      setSlotIds(next);
    }
  }

  async function handleResolve() {
    if (!input.trim()) return;
    setIsResolving(true);
    setResolveError(null);
    setPreview(null);
    setAddError(null);

    const result = await resolveYouTubeChannel({ input: input.trim() });

    if (result.ok) {
      // Check if this channel already exists as a default chef
      const isDuplicateDefault = CHEFS.some(
        (c) => c.youtubeChannelId === result.channelId
      );
      if (isDuplicateDefault) {
        setAddError("This chef is already in Featured Chefs.");
        setIsResolving(false);
        return;
      }
      setPreview({
        channelId: result.channelId,
        channelName: result.channelName,
        channelThumbnail: result.channelThumbnail,
        resolvedAt: result.resolvedAt,
      });
    } else {
      setResolveError(result.error);
    }

    setIsResolving(false);
  }

  async function handleAdd() {
    if (!preview || !sessionId) return;
    setAddError(null);

    try {
      await addCustomChef({
        sessionId,
        channelId: preview.channelId,
        channelName: preview.channelName,
        channelThumbnail: preview.channelThumbnail,
        resolvedAt: preview.resolvedAt,
      });
      // Auto-add to slots if under limit
      if (slotIds.length < MAX_CHEF_TABLE_SLOTS) {
        const next = [...slotIds, preview.channelId];
        setSlotIdsState(next);
        setSlotIds(next);
      }
      setInput("");
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("duplicate") || customChefs.some((c) => c.channelId === preview.channelId)) {
        setAddError("This chef is already in your list.");
      } else if (message.toLowerCase().includes("limit")) {
        setAddError(`You've reached the ${MAX_CUSTOM_CHEFS}-chef limit.`);
      } else {
        setAddError("Something went wrong — try again.");
      }
    }
  }

  async function handleRemove(channelId: string) {
    if (!sessionId) return;
    await removeCustomChef({ sessionId, channelId });
    // Remove from slots too
    const next = slotIds.filter((id) => id !== channelId);
    setSlotIdsState(next);
    setSlotIds(next);
  }

  const selectedCount = slotIds.length;

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/" className="text-[#D4622A] text-sm mb-6 block hover:underline mt-6 sm:mt-0">
          ← Back to search
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">My Chefs</h1>
        <p className="text-gray-500 text-sm mb-2">
          Manage your Chef&apos;s Table lineup
        </p>
        <p className="text-xs text-gray-400 mb-6">
          {selectedCount} of {MAX_CHEF_TABLE_SLOTS} selected for Chef&apos;s Table
        </p>

        {slotWarning && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-700 text-sm">
              You can show up to {MAX_CHEF_TABLE_SLOTS} chefs on Chef&apos;s Table. Uncheck one to add another.
            </p>
          </div>
        )}

        {/* Featured Chefs section */}
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Featured Chefs</span>
          </div>
          <div className="flex flex-col gap-2">
            {CHEFS.map((chef) => {
              const isSlotted = slotIds.includes(chef.id);
              return (
                <button
                  key={chef.id}
                  type="button"
                  onClick={() => toggleSlot(chef.id)}
                  className={`flex items-center gap-3 p-3 bg-white rounded-2xl border text-left transition-all ${
                    isSlotted ? "border-[#D4622A] bg-orange-50/50" : "border-gray-200"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSlotted ? "border-[#D4622A] bg-[#D4622A]" : "border-gray-300"
                  }`}>
                    {isSlotted && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8.5l3 3 5-5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xl flex-shrink-0">{chef.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#1A3A2A] truncate">{chef.name}</p>
                    <p className="text-xs text-gray-400">{chef.country}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Your Chefs section */}
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Your Chefs</span>
            <span className="text-xs text-gray-300">({customChefs.length}/{MAX_CUSTOM_CHEFS})</span>
          </div>

          {customChefs.length === 0 ? (
            <p className="text-gray-400 text-sm mb-4">
              No custom chefs added yet — add one below.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {customChefs.map((chef) => {
                const isSlotted = slotIds.includes(chef.channelId);
                return (
                  <div
                    key={chef.channelId}
                    className={`flex items-center gap-3 p-3 bg-white rounded-2xl border transition-all ${
                      isSlotted ? "border-[#D4622A] bg-orange-50/50" : "border-gray-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSlot(chef.channelId)}
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSlotted ? "border-[#D4622A] bg-[#D4622A]" : "border-gray-300"
                      }`}
                    >
                      {isSlotted && (
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M4 8.5l3 3 5-5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <img
                      src={chef.channelThumbnail}
                      alt={chef.channelName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <span className="flex-1 text-sm font-semibold text-[#1A3A2A] truncate">
                      {chef.channelName}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemove(chef.channelId)}
                      className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0 text-lg leading-none"
                      aria-label={`Remove ${chef.channelName}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add custom chef section */}
          {atCustomLimit ? (
            <p className="text-gray-500 text-sm bg-white rounded-2xl border border-gray-200 p-4">
              You&apos;ve reached the {MAX_CUSTOM_CHEFS}-chef limit. Remove a chef to add another.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setResolveError(null);
                    setPreview(null);
                    setAddError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleResolve();
                  }}
                  placeholder="YouTube channel URL or @handle"
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#D4622A] bg-white"
                />
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={isResolving || !input.trim()}
                  className="bg-[#D4622A] text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 hover:bg-[#bf5724] transition-colors"
                >
                  {isResolving ? "Finding…" : "Find"}
                </button>
              </div>

              {resolveError && (
                <p className="text-red-500 text-sm">
                  {RESOLVE_ERROR_MESSAGES[resolveError]}
                </p>
              )}

              {addError && (
                <p className="text-red-500 text-sm">{addError}</p>
              )}

              {preview && (
                <CustomChefCard
                  chef={preview}
                  onAdd={handleAdd}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/my-chefs/page.tsx
git commit -m "feat: redesign My Chefs with sections and slot toggles"
```

---

### Task 6: Clean up — remove unused `getSelectedChefs` import from `page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Step 1:** Verify that `getSelectedChefs` is no longer referenced anywhere in `app/page.tsx` after Task 4 changes. If the old function is still exported from `lib/chefs.ts`, it can stay for backwards compatibility but is no longer imported in `page.tsx`.

**Step 2: Commit (if any cleanup needed)**

```bash
git add app/page.tsx lib/chefs.ts
git commit -m "chore: remove unused getSelectedChefs import"
```

---

### Task 7: Verify everything works locally

**Step 1: Run the dev server**

```bash
cd C:/Users/abhiv/claudecode_projects/fridge_to_table
npm run dev
```

**Step 2: Manual verification checklist**

1. Home page → Chef's Table tab:
   - Grid shows 8 default chefs (all pre-selected on fresh localStorage)
   - "Edit chefs" link visible next to "Choose your chefs"
   - "Edit chefs" navigates to `/my-chefs`
   - Per-search toggle works (select/deselect individual chefs)

2. My Chefs page (`/my-chefs`):
   - "Featured Chefs" section shows 8 defaults with checkmarks
   - "Your Chefs" section shows custom chefs (if any)
   - Checkmark toggles work — checked = appears on Chef's Table
   - Shows "X of 8 selected for Chef's Table" counter
   - Trying to check a 9th shows amber warning message
   - Unchecking a chef removes them from Chef's Table
   - Adding a custom chef via URL still works
   - Removing a custom chef removes from slots too
   - Adding a chef whose channel matches a default shows error

3. Navigation flow:
   - Chef's Table → Edit chefs → toggle some off → go back → grid reflects changes
   - Add a custom chef → check it → go to Chef's Table → custom chef visible with thumbnail

**Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors

**Step 4: Build check**

```bash
npm run build
```

Expected: build succeeds
