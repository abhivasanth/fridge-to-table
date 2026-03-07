# Sidebar Navigation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace navbar links and "My Chefs" home tab with a slide-out sidebar containing navigation, pinned searches, and recent search history.

**Architecture:** New Sidebar component rendered in layout via ClientNav. Search history persisted in localStorage (ported from v3 branch). Navbar simplified to hamburger + logo. Home page tabs reduced to two.

**Tech Stack:** Next.js 15, React, Tailwind CSS, Vitest, localStorage

---

### Task 1: Add HistoryEntry type to types/recipe.ts

**Files:**
- Modify: `types/recipe.ts`
- Test: `tests/unit/searchHistory.test.ts` (created in Task 2)

**Step 1: Add the HistoryEntry type**

Add to the bottom of `types/recipe.ts`:

```ts
export type HistoryEntry = {
  id: string;
  query: string;
  timestamp: number;
  resultType: "recipes" | "chefs";
  recipeSetId?: string;
  videoResults?: ChefVideoResult[];
  pinned?: boolean;
};
```

**Step 2: Commit**

```bash
git add types/recipe.ts
git commit -m "feat: add HistoryEntry type to recipe types"
```

---

### Task 2: Create lib/searchHistory.ts with tests

**Files:**
- Create: `lib/searchHistory.ts`
- Create: `tests/unit/searchHistory.test.ts`

**Step 1: Write the failing tests**

Create `tests/unit/searchHistory.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadHistory,
  saveHistoryEntry,
  clearHistory,
  deleteHistoryEntry,
  updateHistoryEntry,
  SEARCH_HISTORY_STORAGE_KEY,
} from "@/lib/searchHistory";
import type { HistoryEntry } from "@/types/recipe";

describe("searchHistory", () => {
  beforeEach(() => localStorage.clear());

  it("returns empty array when no history", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("prepends new entries", () => {
    const entry1: HistoryEntry = { id: "1", query: "eggs, milk", timestamp: 1000, resultType: "recipes", recipeSetId: "abc" };
    const entry2: HistoryEntry = { id: "2", query: "chicken", timestamp: 2000, resultType: "recipes", recipeSetId: "def" };
    saveHistoryEntry(entry1);
    saveHistoryEntry(entry2);
    const history = loadHistory();
    expect(history[0].id).toBe("2");
    expect(history[1].id).toBe("1");
  });

  it("clears history", () => {
    const entry: HistoryEntry = { id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" };
    saveHistoryEntry(entry);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });

  it("caps history at 50 entries", () => {
    for (let i = 0; i < 51; i++) {
      saveHistoryEntry({ id: String(i), query: `query ${i}`, timestamp: i, resultType: "recipes" });
    }
    expect(loadHistory()).toHaveLength(50);
  });

  it("returns empty array when localStorage has malformed data", () => {
    localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, "not-json");
    expect(loadHistory()).toEqual([]);
  });

  it("deletes a single entry by id", () => {
    saveHistoryEntry({ id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" });
    saveHistoryEntry({ id: "2", query: "milk", timestamp: 2000, resultType: "recipes" });
    deleteHistoryEntry("1");
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("2");
  });

  it("delete is a no-op for non-existent id", () => {
    saveHistoryEntry({ id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" });
    deleteHistoryEntry("999");
    expect(loadHistory()).toHaveLength(1);
  });

  it("updates an entry (rename)", () => {
    saveHistoryEntry({ id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" });
    updateHistoryEntry("1", { query: "eggs and cheese" });
    expect(loadHistory()[0].query).toBe("eggs and cheese");
  });

  it("updates an entry (pin)", () => {
    saveHistoryEntry({ id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" });
    updateHistoryEntry("1", { pinned: true });
    expect(loadHistory()[0].pinned).toBe(true);
  });

  it("update is a no-op for non-existent id", () => {
    saveHistoryEntry({ id: "1", query: "eggs", timestamp: 1000, resultType: "recipes" });
    updateHistoryEntry("999", { query: "nope" });
    expect(loadHistory()[0].query).toBe("eggs");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/searchHistory.test.ts`
Expected: FAIL — module `@/lib/searchHistory` not found

**Step 3: Create the implementation**

Create `lib/searchHistory.ts`:

```ts
import type { HistoryEntry } from "@/types/recipe";

export const SEARCH_HISTORY_STORAGE_KEY = "ftt_search_history";
const MAX_ENTRIES = 50;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const existing = loadHistory();
  const updated = [entry, ...existing].slice(0, MAX_ENTRIES);
  localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
}

export function deleteHistoryEntry(id: string): void {
  if (typeof window === "undefined") return;
  const existing = loadHistory();
  const updated = existing.filter((e) => e.id !== id);
  localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
}

export function updateHistoryEntry(id: string, updates: Partial<Pick<HistoryEntry, "query" | "pinned">>): void {
  if (typeof window === "undefined") return;
  const existing = loadHistory();
  const idx = existing.findIndex((e) => e.id === id);
  if (idx === -1) return;
  existing[idx] = { ...existing[idx], ...updates };
  localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(existing));
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/searchHistory.test.ts`
Expected: All 10 tests PASS

**Step 5: Commit**

```bash
git add lib/searchHistory.ts tests/unit/searchHistory.test.ts
git commit -m "feat: add search history localStorage helper with tests"
```

---

### Task 3: Create Sidebar component with tests

**Files:**
- Create: `components/Sidebar.tsx`
- Create: `tests/unit/Sidebar.test.tsx`

**Step 1: Write the failing tests**

Create `tests/unit/Sidebar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import type { HistoryEntry } from "@/types/recipe";

const mockHistory: HistoryEntry[] = [
  { id: "1", query: "eggs, milk", timestamp: Date.now(), resultType: "recipes", recipeSetId: "abc" },
  { id: "2", query: "chicken steak", timestamp: Date.now() - 86400001, resultType: "chefs", videoResults: [], pinned: true },
];

vi.mock("@/lib/searchHistory", () => ({
  loadHistory: vi.fn(() => mockHistory),
  deleteHistoryEntry: vi.fn(),
  updateHistoryEntry: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

describe("Sidebar", () => {
  it("renders hidden when open is false", () => {
    const { container } = render(
      <Sidebar open={false} onClose={vi.fn()} />
    );
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(-100%)");
  });

  it("renders visible when open is true", () => {
    const { container } = render(
      <Sidebar open={true} onClose={vi.fn()} />
    );
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(0)");
  });

  it("renders nav links for Search Recipes, My Chefs, Favorites", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Search Recipes")).toBeInTheDocument();
    expect(screen.getByText("My Chefs")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
  });

  it("renders New Search button", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText(/New Search/)).toBeInTheDocument();
  });

  it("renders pinned entries under PINNED section", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("PINNED")).toBeInTheDocument();
    expect(screen.getByText("chicken steak")).toBeInTheDocument();
  });

  it("renders recent entries under RECENT SEARCHES section", () => {
    render(<Sidebar open={true} onClose={vi.fn()} />);
    expect(screen.getByText("RECENT SEARCHES")).toBeInTheDocument();
    expect(screen.getByText("eggs, milk")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId("sidebar-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText("Close menu"));
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/Sidebar.test.tsx`
Expected: FAIL — module `@/components/Sidebar` not found

**Step 3: Create the Sidebar component**

Create `components/Sidebar.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadHistory, deleteHistoryEntry, updateHistoryEntry } from "@/lib/searchHistory";
import type { HistoryEntry } from "@/types/recipe";

type Props = {
  open: boolean;
  onClose: () => void;
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function HistoryItem({
  entry,
  onNavigate,
  onDelete,
  onRename,
  onTogglePin,
}: {
  entry: HistoryEntry;
  onNavigate: () => void;
  onDelete: () => void;
  onRename: (newQuery: string) => void;
  onTogglePin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(entry.query);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  function handleTouchStart() {
    longPressTimer.current = setTimeout(() => setMenuOpen(true), 500);
  }

  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  function handleRenameConfirm() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== entry.query) onRename(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="px-3 py-2">
        <input
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameConfirm();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={handleRenameConfirm}
          className="w-full text-sm text-[#1A3A2A] bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-[#C4622A]"
        />
      </div>
    );
  }

  return (
    <div
      className="relative group"
      ref={menuRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      <button
        type="button"
        onClick={onNavigate}
        className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors"
      >
        <span className="text-sm text-[#1A3A2A] truncate flex-1">{entry.query}</span>
        <span className="text-xs text-gray-400 flex-shrink-0">{relativeTime(entry.timestamp)}</span>
      </button>

      {/* Three-dot menu trigger (desktop hover) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Entry options"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36 z-50">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setEditValue(entry.query); setEditing(true); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11.5 1.5l3 3-9 9H2.5v-3l9-9z" strokeLinejoin="round"/></svg>
            Rename
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9.5 1.5l5 5-4 4-2-1-3 3.5-1-1 3.5-3-1-2-4 4z" strokeLinejoin="round"/></svg>
            {entry.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5.5 4V2.5h5V4M6.5 7v5M9.5 7v5M3.5 4l1 10h7l1-10" strokeLinejoin="round" strokeLinecap="round"/></svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ open, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const currentDragX = useRef(0);
  const isDragging = useRef(false);
  const SIDEBAR_WIDTH = 320;
  const CLOSE_THRESHOLD = SIDEBAR_WIDTH * 0.4;

  const refreshHistory = useCallback(() => setHistory(loadHistory()), []);

  useEffect(() => {
    if (open) refreshHistory();
  }, [open, refreshHistory]);

  // Mobile swipe-to-dismiss
  function handleTouchStart(e: React.TouchEvent) {
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    currentDragX.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX.current === null) return;
    const dx = dragStartX.current - e.touches[0].clientX;
    currentDragX.current = Math.max(0, dx);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(-${currentDragX.current}px)`;
    }
  }

  function handleTouchEnd() {
    if (panelRef.current) panelRef.current.style.transition = "transform 0.25s ease";
    if (currentDragX.current > CLOSE_THRESHOLD) {
      onClose();
    } else if (panelRef.current) {
      panelRef.current.style.transform = "translateX(0)";
    }
    dragStartX.current = null;
    currentDragX.current = 0;
    isDragging.current = false;
  }

  function navigateTo(href: string) {
    onClose();
    router.push(href);
  }

  function handleHistoryNav(entry: HistoryEntry) {
    onClose();
    if (entry.resultType === "recipes" && entry.recipeSetId) {
      router.push(`/results/${entry.recipeSetId}`);
    } else if (entry.resultType === "chefs" && entry.videoResults) {
      localStorage.setItem("chefTableResults", JSON.stringify(entry.videoResults));
      router.push("/chef-results");
    }
  }

  function handleDelete(id: string) {
    deleteHistoryEntry(id);
    refreshHistory();
  }

  function handleRename(id: string, newQuery: string) {
    updateHistoryEntry(id, { query: newQuery });
    refreshHistory();
  }

  function handleTogglePin(id: string, currentlyPinned: boolean) {
    updateHistoryEntry(id, { pinned: !currentlyPinned });
    refreshHistory();
  }

  const pinned = history.filter((e) => e.pinned);
  const recent = history.filter((e) => !e.pinned);

  const navItems = [
    { label: "Search Recipes", href: "/", icon: "search" },
    { label: "My Chefs", href: "/my-chefs", icon: "chef" },
    { label: "Favorites", href: "/favourites", icon: "heart" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="sidebar-backdrop"
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(0,0,0,0.3)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Sidebar panel */}
      <div
        ref={panelRef}
        data-testid="sidebar-panel"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: `${SIDEBAR_WIDTH}px`, zIndex: 95,
          background: "#FAF6F1",
          borderRight: "1px solid rgba(45, 74, 46, 0.08)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span
            className="text-base font-medium"
            style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)", color: "#C5451A" }}
          >
            fridge <span style={{ fontWeight: 300, opacity: 0.4 }}>to</span> table
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* + New Search */}
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => navigateTo("/")}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: "12px",
              background: "#C4622A", color: "white", border: "none",
              fontSize: "14px", fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>+</span> New Search
          </button>
        </div>

        {/* Nav links */}
        <div className="px-3 pb-2 space-y-0.5">
          {navItems.map((item) => (
            <button
              key={item.href}
              type="button"
              onClick={() => navigateTo(item.href)}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === item.href
                  ? "bg-[#F0EBE3] text-[#1A3A2A]"
                  : "text-gray-600 hover:bg-white hover:text-[#1A3A2A]"
              }`}
            >
              {item.icon === "search" && (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14" strokeLinecap="round"/></svg>
              )}
              {item.icon === "chef" && (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 14v-1a2 2 0 012-2h4a2 2 0 012 2v1" strokeLinecap="round"/><circle cx="8" cy="6" r="2.5"/><path d="M5 4.5C4 4 3 3 3.5 1.5 5 2 5.5 3 5.5 3.5M11 4.5C12 4 13 3 12.5 1.5 11 2 10.5 3 10.5 3.5" strokeLinecap="round"/></svg>
              )}
              {item.icon === "heart" && (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 13.5L2.05 7.55C1.02 6.52 1.02 4.85 2.05 3.82C3.08 2.79 4.75 2.79 5.78 3.82L8 6.04L10.22 3.82C11.25 2.79 12.92 2.79 13.95 3.82C14.98 4.85 14.98 6.52 13.95 7.55L8 13.5Z" strokeLinejoin="round"/></svg>
              )}
              {item.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-100" />

        {/* Pinned section */}
        {pinned.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9.5 1.5l5 5-4 4-2-1-3 3.5-1-1 3.5-3-1-2-4 4z" strokeLinejoin="round"/></svg>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pinned</span>
            </div>
            {pinned.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onNavigate={() => handleHistoryNav(entry)}
                onDelete={() => handleDelete(entry.id)}
                onRename={(q) => handleRename(entry.id, q)}
                onTogglePin={() => handleTogglePin(entry.id, !!entry.pinned)}
              />
            ))}
          </div>
        )}

        {/* Recent searches */}
        <div className="flex-1 px-4 pt-4 pb-4 overflow-y-auto">
          <div className="flex items-center gap-1.5 mb-2">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recent Searches</span>
          </div>
          {recent.length === 0 && pinned.length === 0 && (
            <p className="text-xs text-gray-400 text-center pt-6">No search history yet</p>
          )}
          {recent.map((entry) => (
            <HistoryItem
              key={entry.id}
              entry={entry}
              onNavigate={() => handleHistoryNav(entry)}
              onDelete={() => handleDelete(entry.id)}
              onRename={(q) => handleRename(entry.id, q)}
              onTogglePin={() => handleTogglePin(entry.id, !!entry.pinned)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/Sidebar.test.tsx`
Expected: All 8 tests PASS

**Step 5: Commit**

```bash
git add components/Sidebar.tsx tests/unit/Sidebar.test.tsx
git commit -m "feat: add Sidebar component with nav links, history, pin/rename/delete"
```

---

### Task 4: Update Navbar — add hamburger, remove nav links

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `tests/unit/Navbar.test.tsx`

**Step 1: Update Navbar tests**

Replace `tests/unit/Navbar.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Navbar", () => {
  it("renders the brand logo", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.getByLabelText("fridge to table")).toBeInTheDocument();
  });

  it("logo link points to /", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    const logoLink = screen.getByRole("link", { name: /fridge to table/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders hamburger menu button", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("calls onMenuClick when hamburger is clicked", () => {
    const onMenuClick = vi.fn();
    render(<Navbar onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it("does not render My Chefs or Favorites nav links", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.queryByText("My Chefs")).not.toBeInTheDocument();
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/Navbar.test.tsx`
Expected: FAIL — `onMenuClick` prop not expected, old tests fail

**Step 3: Update the Navbar component**

Replace `components/Navbar.tsx` content. Keep the `WordmarkLogo` function as-is. Replace the `Navbar` export:

```tsx
"use client";
import Link from "next/link";

function WordmarkLogo() {
  // ... (keep existing SVG exactly as-is)
}

type NavbarProps = {
  onMenuClick: () => void;
};

export function Navbar({ onMenuClick }: NavbarProps) {
  return (
    <nav
      className="sticky top-0 z-50 animate-slide-down"
      style={{
        background: "rgba(250, 247, 242, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(45, 74, 46, 0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Hamburger */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>

        {/* Logo wordmark */}
        <Link
          href="/"
          className="flex items-center"
          style={{ transition: "transform 0.3s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <WordmarkLogo />
        </Link>
      </div>
    </nav>
  );
}
```

Note: Remove the `usePathname` import — it's no longer needed since the nav links are gone.

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/Navbar.test.tsx`
Expected: All 5 tests PASS

**Step 5: Commit**

```bash
git add components/Navbar.tsx tests/unit/Navbar.test.tsx
git commit -m "feat: add hamburger icon to Navbar, remove My Chefs and Favorites links"
```

---

### Task 5: Wire Sidebar into ClientNav

**Files:**
- Modify: `components/ClientNav.tsx`
- Modify: `tests/unit/ClientNav.test.tsx`

**Step 1: Update ClientNav test**

Replace `tests/unit/ClientNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/searchHistory", () => ({
  loadHistory: vi.fn(() => []),
  deleteHistoryEntry: vi.fn(),
  updateHistoryEntry: vi.fn(),
}));

describe("ClientNav", () => {
  it("renders the Navbar with hamburger", () => {
    render(<ClientNav />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("opens sidebar when hamburger is clicked", () => {
    const { container } = render(<ClientNav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(0)");
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/ClientNav.test.tsx`
Expected: FAIL

**Step 3: Update ClientNav**

Replace `components/ClientNav.tsx`:

```tsx
"use client";
import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";

export function ClientNav() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/ClientNav.test.tsx`
Expected: All 2 tests PASS

**Step 5: Commit**

```bash
git add components/ClientNav.tsx tests/unit/ClientNav.test.tsx
git commit -m "feat: wire Sidebar into ClientNav with open/close state"
```

---

### Task 6: Remove My Chefs tab from home page + save search history

**Files:**
- Modify: `app/page.tsx`

**Step 1: Remove My Chefs tab**

In `app/page.tsx`, make these changes:

1. Change the `ActiveTab` type:
```ts
type ActiveTab = "any-recipe" | "chefs-table";
```

2. Remove the `customChefs` query and its import usage. Remove the `sessionId` variable used only for that query (keep it in `handleSubmit` where it's declared locally). Remove the `useQuery` import of `api.customChefs.listCustomChefs`.

3. Update `chefsTableDisabled` — remove the `my-chefs` condition:
```ts
const chefsTableDisabled = activeTab === "chefs-table" && selectedChefIds.length === 0;
```

4. Update the tab selector to only render two tabs:
```tsx
<div className="flex gap-1 bg-gray-50 rounded-2xl p-1 mb-6">
  {(["any-recipe", "chefs-table"] as ActiveTab[]).map((tab) => (
    <button
      key={tab}
      onClick={() => setActiveTab(tab)}
      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
        activeTab === tab
          ? "bg-[#D4622A] text-white shadow-sm"
          : "text-gray-500 hover:text-gray-700"
      }`}
    >
      {tab === "any-recipe" && "Any Recipe"}
      {tab === "chefs-table" && (
        <>
          Chef&apos;s Table
          <VerifiedBadge active={activeTab === "chefs-table"} />
        </>
      )}
    </button>
  ))}
</div>
```

5. Remove the entire `{activeTab === "my-chefs" && (...)}` block (lines 294-330 of current page.tsx).

6. Remove the `my-chefs` branch from `handleSubmit` (the `else if (activeTab === "my-chefs")` block).

**Step 2: Add search history saving to handleSubmit**

Add import at top of `app/page.tsx`:
```ts
import { saveHistoryEntry } from "@/lib/searchHistory";
```

In `handleSubmit`, after the successful recipe/chef search, save the entry:

For the `chefs-table` branch (after `router.push("/chef-results")`):
```ts
saveHistoryEntry({
  id: crypto.randomUUID(),
  query: finalIngredients.join(", "),
  timestamp: Date.now(),
  resultType: "chefs",
  videoResults: results,
});
```

For the `any-recipe` (else) branch (after `router.push(...)`):
```ts
saveHistoryEntry({
  id: crypto.randomUUID(),
  query: finalIngredients.join(", "),
  timestamp: Date.now(),
  resultType: "recipes",
  recipeSetId,
});
```

**Step 3: Clean up unused imports**

Remove `getSessionId` import from the top level (it's only needed inside `handleSubmit` now — actually it's already used inside handleSubmit locally, so remove the top-level usage). Remove the `customChefs` variable. If `useQuery` is no longer used by anything else, check — `useQuery` is still used if there are other queries. In this case, `customChefs` was the only `useQuery` call, but `useAction` is still needed. Remove `useQuery` from the import if no longer used.

**Step 4: Verify the app compiles**

Run: `npx next build` or `npx next dev` and check for TypeScript errors.

**Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: remove My Chefs tab, save search history on submit"
```

---

### Task 7: Manual verification and cleanup

**Step 1: Run all unit tests**

Run: `npx vitest run`
Expected: All tests pass. Fix any failures.

**Step 2: Run the dev server and manually test**

Run: `npx next dev`

Test checklist:
- [ ] Hamburger icon visible in navbar, left of logo
- [ ] No My Chefs or Favorites links in navbar
- [ ] Click hamburger opens sidebar with smooth slide animation
- [ ] Sidebar shows: New Search, Search Recipes, My Chefs, Favorites, Recent Searches
- [ ] Click X closes sidebar
- [ ] Click backdrop closes sidebar
- [ ] On mobile (use devtools responsive mode): swipe left to dismiss sidebar
- [ ] Home page shows only two tabs: Any Recipe and Chef's Table
- [ ] Submit a search on "Any Recipe" tab — navigates to results, sidebar shows it in Recent
- [ ] Submit a search on "Chef's Table" tab — navigates to chef results, sidebar shows it in Recent
- [ ] Click a recent search entry — navigates to its results page
- [ ] Three-dot menu on history entry — Rename, Pin, Delete all work
- [ ] Long-press on mobile shows the same menu
- [ ] Pinned entries appear in PINNED section above RECENT SEARCHES
- [ ] My Chefs and Favorites links in sidebar navigate correctly

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address manual testing feedback"
```
