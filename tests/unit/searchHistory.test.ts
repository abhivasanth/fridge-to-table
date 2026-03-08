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
