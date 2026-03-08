"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { loadHistory, deleteHistoryEntry, updateHistoryEntry } from "@/lib/searchHistory";
import type { HistoryEntry } from "@/types/recipe";

type Props = {
  open: boolean;
  onClose: () => void;
  isDesktop: boolean;
  onDragOffset?: (offset: number) => void;
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

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} className="bg-amber-200/60 text-[#1A3A2A] rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function HistoryItem({
  entry,
  onNavigate,
  onDelete,
  onRename,
  onTogglePin,
  searchQuery = "",
}: {
  entry: HistoryEntry;
  onNavigate: () => void;
  onDelete: () => void;
  onRename: (newQuery: string) => void;
  onTogglePin: () => void;
  searchQuery?: string;
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
        <span className="text-sm text-[#1A3A2A] truncate flex-1">
          <HighlightedText text={entry.query} query={searchQuery} />
        </span>
        {/* Timestamp — visible by default, hidden on hover (swaps with three-dot) */}
        <span className="text-xs text-gray-400 flex-shrink-0 group-hover:opacity-0 transition-opacity">
          {relativeTime(entry.timestamp)}
        </span>
      </button>

      {/* Three-dot menu trigger — hidden by default, visible on hover (swaps with timestamp) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Entry options"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
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

export function Sidebar({ open, onClose, isDesktop, onDragOffset }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const currentDragX = useRef(0);
  const isDragging = useRef(false);
  const SIDEBAR_WIDTH = 320;
  const CLOSE_THRESHOLD = SIDEBAR_WIDTH * 0.4;
  const isSearching = searchQuery.trim().length > 0;

  const refreshHistory = useCallback(() => setHistory(loadHistory()), []);

  useEffect(() => {
    if (open) {
      refreshHistory();
    } else {
      setSearchQuery("");
    }
  }, [open, refreshHistory]);

  // Mobile swipe-to-dismiss (swipe LEFT to close, since panel is on the left)
  function handleTouchStart(e: React.TouchEvent) {
    if (isDesktop) return;
    isDragging.current = true;
    dragStartX.current = e.touches[0].clientX;
    currentDragX.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (isDesktop || dragStartX.current === null) return;
    const dx = dragStartX.current - e.touches[0].clientX;
    currentDragX.current = Math.max(0, dx);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(-${currentDragX.current}px)`;
    }
    onDragOffset?.(currentDragX.current);
  }

  function handleTouchEnd() {
    if (isDesktop) return;
    if (panelRef.current) panelRef.current.style.transition = "transform 0.25s ease";
    if (currentDragX.current > CLOSE_THRESHOLD) {
      onClose();
    } else if (panelRef.current) {
      panelRef.current.style.transform = "translateX(0)";
    }
    onDragOffset?.(0);
    dragStartX.current = null;
    currentDragX.current = 0;
    isDragging.current = false;
  }

  function navigateTo(href: string) {
    if (!isDesktop) onClose();
    router.push(href);
  }

  function handleHistoryNav(entry: HistoryEntry) {
    if (!isDesktop) onClose();
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

  const filterEntries = (entries: HistoryEntry[]) => {
    if (!isSearching) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => e.query.toLowerCase().includes(q));
  };

  const pinned = filterEntries(history.filter((e) => e.pinned));
  const recent = filterEntries(history.filter((e) => !e.pinned));
  const totalResults = pinned.length + recent.length;

  const navItems = [
    { label: "My Chefs", href: "/my-chefs", icon: "chef" },
    { label: "Favorites", href: "/favourites", icon: "heart" },
  ];

  return (
    <>
      {/* Backdrop — mobile only */}
      {!isDesktop && (
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
      )}

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
        <div className="flex items-center px-5 py-4 border-b border-gray-100">
          <span
            className="text-base font-medium"
            style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)", color: "#C5451A" }}
          >
            fridge <span style={{ fontWeight: 300, opacity: 0.4 }}>to</span> table
          </span>
        </div>

        {/* Search input */}
        <div className="px-4 pt-3 pb-1">
          <div className="relative">
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5"
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            >
              <circle cx="7" cy="7" r="4.5"/>
              <path d="M10.5 10.5L14 14" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); searchInputRef.current?.blur(); } }}
              placeholder="Search past recipes..."
              className="w-full text-sm text-[#1A3A2A] bg-white/80 border border-gray-200 rounded-xl pl-9 pr-8 py-2.5 outline-none focus:border-[#C4622A] focus:bg-white transition-colors placeholder:text-gray-400"
            />
            {isSearching && (
              <button
                type="button"
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M2 2l6 6M8 2l-6 6"/>
                </svg>
              </button>
            )}
          </div>
          {isSearching && (
            <p className="text-xs text-gray-400 mt-1.5 ml-1">
              {totalResults} result{totalResults !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* New Search + Nav links — hidden when searching */}
        {!isSearching && (
          <>
            {/* + New Search */}
            <div className="px-4 py-2">
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
          </>
        )}

        {/* No results state when searching */}
        {isSearching && totalResults === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="#d1d5db" strokeWidth="1.2" className="mb-3">
              <circle cx="7" cy="7" r="4.5"/>
              <path d="M10.5 10.5L14 14" strokeLinecap="round"/>
            </svg>
            <p className="text-sm text-gray-400 text-center">No matches found</p>
            <p className="text-xs text-gray-300 text-center mt-1">Try different keywords</p>
          </div>
        )}

        {/* Pinned section */}
        {pinned.length > 0 && (
          <div className="px-4 pt-4 pb-2">
            {!isSearching && (
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M9.5 1.5l5 5-4 4-2-1-3 3.5-1-1 3.5-3-1-2-4 4z" strokeLinejoin="round"/></svg>
                <span className="text-xs font-semibold text-gray-400 tracking-wide">PINNED</span>
              </div>
            )}
            {pinned.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onNavigate={() => handleHistoryNav(entry)}
                onDelete={() => handleDelete(entry.id)}
                onRename={(q) => handleRename(entry.id, q)}
                onTogglePin={() => handleTogglePin(entry.id, !!entry.pinned)}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}

        {/* Recent searches */}
        {(recent.length > 0 || (!isSearching && pinned.length === 0)) && (
          <div className="flex-1 px-4 pt-4 pb-4 overflow-y-auto">
            {!isSearching && (
              <div className="flex items-center gap-1.5 mb-2">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#9ca3af" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span className="text-xs font-semibold text-gray-400 tracking-wide">RECENT SEARCHES</span>
              </div>
            )}
            {recent.length === 0 && pinned.length === 0 && !isSearching && (
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
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
