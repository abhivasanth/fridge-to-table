import type { HistoryEntry } from "@/types/v3";

export const SEARCH_HISTORY_STORAGE_KEY = "ftt_search_history_v3";
const STORAGE_KEY = SEARCH_HISTORY_STORAGE_KEY;
const MAX_ENTRIES = 50;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
