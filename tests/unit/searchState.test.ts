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
