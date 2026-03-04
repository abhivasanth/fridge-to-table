"use client";
import { useEffect, useRef, useState } from "react";
import { loadHistory } from "@/lib/searchHistory";
import type { HistoryEntry } from "@/types/v3";

type Props = {
  open: boolean;
  onClose: () => void;
  onNewSearch: () => void;
  onSelectHistory: (entry: HistoryEntry) => void;
};

function groupByDate(entries: HistoryEntry[]): { label: string; entries: HistoryEntry[] }[] {
  const today = new Date().setHours(0, 0, 0, 0);
  const yesterday = today - 86400000;
  const groups: Map<string, HistoryEntry[]> = new Map();

  for (const entry of entries) {
    const d = new Date(entry.timestamp).setHours(0, 0, 0, 0);
    let label: string;
    if (d >= today) label = "Today";
    else if (d >= yesterday) label = "Yesterday";
    else label = new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(entry);
  }

  return Array.from(groups.entries()).map(([label, entries]) => ({ label, entries }));
}

export function Sidebar({ open, onClose, onNewSearch, onSelectHistory }: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [search, setSearch] = useState("");

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef<number | null>(null);
  const currentDragX = useRef(0);
  const SIDEBAR_WIDTH = 280;
  const CLOSE_THRESHOLD = SIDEBAR_WIDTH * 0.4; // 112px

  function handleTouchStart(e: React.TouchEvent) {
    dragStartX.current = e.touches[0].clientX;
    currentDragX.current = 0;
    if (panelRef.current) panelRef.current.style.transition = "none";
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (dragStartX.current === null) return;
    const dx = e.touches[0].clientX - dragStartX.current;
    currentDragX.current = Math.max(0, dx);
    if (panelRef.current) {
      panelRef.current.style.transform = `translateX(${currentDragX.current}px)`;
    }
  }

  function handleTouchEnd() {
    if (panelRef.current) panelRef.current.style.transition = "transform 0.2s ease";
    if (currentDragX.current > CLOSE_THRESHOLD) {
      onClose();
    } else {
      if (panelRef.current) panelRef.current.style.transform = "translateX(0)";
    }
    dragStartX.current = null;
    currentDragX.current = 0;
  }

  useEffect(() => {
    if (open) setHistory(loadHistory());
  }, [open]);

  const filtered = search.trim()
    ? history.filter((e) => e.query.toLowerCase().includes(search.toLowerCase()))
    : history;
  const grouped = groupByDate(filtered);

  return (
    <>
      {/* Backdrop */}
      <div
        data-testid="backdrop"
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: "280px", zIndex: 95,
          background: "#FAF6F1",
          borderRight: "1px solid rgba(45, 74, 46, 0.08)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
          display: "flex", flexDirection: "column",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-[#1A3A2A]">fridge to table</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#9ca3af" }}
          >
            ✕
          </button>
        </div>

        {/* New search */}
        <div className="px-4 py-3">
          <button
            type="button"
            onClick={() => { onNewSearch(); onClose(); }}
            style={{
              width: "100%", padding: "10px 16px", borderRadius: "10px",
              background: "#C4622A", color: "white", border: "none",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
              textAlign: "left",
            }}
          >
            + New search
          </button>
        </div>

        {/* Search filter */}
        <div className="px-4 pb-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            aria-label="Filter history"
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "8px",
              border: "1.5px solid #E8E0D8", background: "white",
              fontSize: "13px", color: "#1A3A2A", outline: "none",
            }}
          />
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {grouped.length === 0 && (
            <p className="text-xs text-gray-400 text-center pt-8">No search history yet</p>
          )}
          {grouped.map(({ label, entries }) => (
            <div key={label} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">{label}</p>
              <div className="space-y-1">
                {entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => { onSelectHistory(entry); onClose(); }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white transition-colors"
                  >
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>
                      {entry.resultType === "chefs" ? "🎬" : "💬"}
                    </span>
                    <span className="text-sm text-[#1A3A2A] truncate">{entry.query}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
