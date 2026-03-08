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
