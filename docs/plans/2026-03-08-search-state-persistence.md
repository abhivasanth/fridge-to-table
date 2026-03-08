# Search State Persistence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Preserve home page search state (tab, ingredients, filters) in `sessionStorage` so back-navigation restores it, while fresh app opens always show a clean page.

**Architecture:** Save search state to `sessionStorage` on submit and on tab switch. On `HomePage` mount, read from `sessionStorage` and hydrate state. `IngredientInput` gets a new `initialText` prop. "New Search" buttons clear `sessionStorage` before navigating.

**Tech Stack:** React, TypeScript, sessionStorage API

---

### Task 1: Create search state persistence utility

**Files:**
- Create: `lib/searchState.ts`
- Test: `tests/unit/searchState.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/searchState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { saveSearchState, loadSearchState, clearSearchState } from "@/lib/searchState";
import type { RecipeFilters } from "@/types/recipe";

beforeEach(() => {
  sessionStorage.clear();
});

describe("searchState", () => {
  it("returns null when nothing is saved", () => {
    expect(loadSearchState()).toBeNull();
  });

  it("saves and loads search state", () => {
    const filters: RecipeFilters = { cuisine: "Italian", maxCookingTime: 45, difficulty: "medium" };
    saveSearchState({
      activeTab: "any-recipe",
      ingredientText: "chicken, garlic",
      filters,
    });
    const loaded = loadSearchState();
    expect(loaded).toEqual({
      activeTab: "any-recipe",
      ingredientText: "chicken, garlic",
      filters,
    });
  });

  it("saves chefs-table tab without filters", () => {
    saveSearchState({
      activeTab: "chefs-table",
      ingredientText: "rice, tofu",
      filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
    });
    const loaded = loadSearchState();
    expect(loaded?.activeTab).toBe("chefs-table");
    expect(loaded?.ingredientText).toBe("rice, tofu");
  });

  it("clears search state", () => {
    saveSearchState({
      activeTab: "any-recipe",
      ingredientText: "eggs",
      filters: { cuisine: "", maxCookingTime: 30, difficulty: "easy" },
    });
    clearSearchState();
    expect(loadSearchState()).toBeNull();
  });

  it("returns null for malformed data", () => {
    sessionStorage.setItem("fridgeToTable_searchState", "not-json");
    expect(loadSearchState()).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/searchState.test.ts`
Expected: FAIL — module not found

**Step 3: Write the implementation**

Create `lib/searchState.ts`:

```ts
import type { RecipeFilters } from "@/types/recipe";

const STORAGE_KEY = "fridgeToTable_searchState";

export type SearchState = {
  activeTab: "any-recipe" | "chefs-table";
  ingredientText: string;
  filters: RecipeFilters;
};

export function saveSearchState(state: SearchState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

export function loadSearchState(): SearchState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SearchState;
  } catch {
    return null;
  }
}

export function clearSearchState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/searchState.test.ts`
Expected: PASS (all 5 tests)

**Step 5: Commit**

```bash
git add lib/searchState.ts tests/unit/searchState.test.ts
git commit -m "feat: add search state persistence utility (sessionStorage)"
```

---

### Task 2: Add initialText prop to IngredientInput

**Files:**
- Modify: `components/IngredientInput.tsx:7-15`
- Modify: `tests/unit/IngredientInput.test.tsx`

**Step 1: Write the failing test**

Add to `tests/unit/IngredientInput.test.tsx`:

```tsx
it("initializes text from initialText prop", () => {
  render(
    <IngredientInput onSubmit={vi.fn()} isLoading={false} initialText="chicken, rice" />
  );
  const textarea = screen.getByPlaceholderText(/type your ingredients/i);
  expect(textarea).toHaveValue("chicken, rice");
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/IngredientInput.test.tsx`
Expected: FAIL — textarea has empty value (initialText prop not recognized)

**Step 3: Update IngredientInput**

In `components/IngredientInput.tsx`, update the Props type and useState:

Change the Props type (line 7-12):
```tsx
type Props = {
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  beforeSubmit?: React.ReactNode;
  initialText?: string;
};
```

Update the component signature and text state (line 14-15):
```tsx
export function IngredientInput({ onSubmit, isLoading, disabled, beforeSubmit, initialText }: Props) {
  const [text, setText] = useState(initialText ?? "");
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/IngredientInput.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/IngredientInput.tsx tests/unit/IngredientInput.test.tsx
git commit -m "feat: add initialText prop to IngredientInput"
```

---

### Task 3: Save and restore state in HomePage

**Files:**
- Modify: `app/page.tsx:1-10` (imports), `app/page.tsx:113-160` (state init + submit)

**Step 1: Update imports**

Add to imports at top of `app/page.tsx`:

```tsx
import { saveSearchState, loadSearchState } from "@/lib/searchState";
```

**Step 2: Update state initialization**

Replace the state declarations (around lines 115-118):

```tsx
// Load saved search state (from sessionStorage) on mount
const [savedState] = useState(() => {
  if (typeof window === "undefined") return null;
  return loadSearchState();
});

const [activeTab, setActiveTab] = useState<ActiveTab>(savedState?.activeTab ?? "any-recipe");
const [filters, setFilters] = useState<RecipeFilters>(savedState?.filters ?? DEFAULT_FILTERS);
const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Step 3: Save tab on switch**

Update the tab button onClick (around line 288):

```tsx
onClick={() => {
  setActiveTab(tab);
  // Persist tab selection for back-navigation
  const current = loadSearchState();
  if (current) {
    saveSearchState({ ...current, activeTab: tab });
  }
}}
```

**Step 4: Save state on submit**

In `handleSubmit`, add save call right before navigation. Add this line just before the `if (activeTab === "chefs-table")` block (around line 182):

```tsx
// Save search state for back-navigation
saveSearchState({
  activeTab,
  ingredientText: finalIngredients.join(", "),
  filters,
});
```

**Step 5: Pass initialText to IngredientInput**

Update the IngredientInput usage (around line 317):

```tsx
<IngredientInput
  onSubmit={handleSubmit}
  isLoading={isLoading}
  disabled={chefsTableDisabled}
  initialText={savedState?.ingredientText}
  beforeSubmit={
    activeTab === "any-recipe" ? (
      <FiltersPanel filters={filters} onChange={setFilters} />
    ) : undefined
  }
/>
```

**Step 6: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: save and restore search state on back-navigation"
```

---

### Task 4: Clear state on "New Search"

**Files:**
- Modify: `components/ClientNav.tsx:117`
- Modify: `components/Sidebar.tsx:417`

**Step 1: Update ClientNav "New Search" button**

In `components/ClientNav.tsx`, add import at top:

```tsx
import { clearSearchState } from "@/lib/searchState";
```

Change the "New Search" icon rail button onClick (line 117):

```tsx
onClick={() => {
  clearSearchState();
  router.push("/");
}}
```

**Step 2: Update Sidebar "New Search" button**

In `components/Sidebar.tsx`, add import at top:

```tsx
import { clearSearchState } from "@/lib/searchState";
```

Change the `navigateTo` function (line 280-283) to clear state when navigating home:

```tsx
function navigateTo(href: string) {
  if (href === "/") clearSearchState();
  if (!isDesktop) onClose();
  router.push(href);
}
```

**Step 3: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

**Step 4: Manual test**

1. Open http://localhost:3000
2. Type ingredients, set filters, switch to Chef's Table tab
3. Hit "Find Recipes" → navigate to results
4. Hit browser back → home page should restore: tab, ingredients, filters
5. Click "New Search" (sidebar or icon rail) → home page should be clean/empty
6. Close browser tab, reopen → home page should be clean (sessionStorage cleared)

**Step 5: Commit**

```bash
git add components/ClientNav.tsx components/Sidebar.tsx
git commit -m "feat: clear search state on New Search navigation"
```
