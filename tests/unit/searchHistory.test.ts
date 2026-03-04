import { describe, it, expect, beforeEach } from "vitest";
import { loadHistory, saveHistoryEntry, clearHistory } from "@/lib/searchHistory";
import type { HistoryEntry } from "@/types/v3";

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
});
