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
