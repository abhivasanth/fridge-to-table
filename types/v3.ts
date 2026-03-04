import type { ChefVideoResult } from "@/types/recipe";

// A single chef slot in the 6-slot grid
export type ChefSlot =
  | { type: "preset"; chefId: string }    // refers to CHEFS in lib/chefs.ts
  | { type: "custom"; channelId: string; channelName: string }
  | { type: "empty" };

// One entry in search history
export type HistoryEntry = {
  id: string;
  query: string;                          // ingredient string for display
  timestamp: number;
  resultType: "recipes" | "chefs";
  recipeSetId?: string;                   // recipes: load from Convex by this ID
  videoResults?: ChefVideoResult[];       // chef videos: stored inline
};

// The 4 filter pills
export type FilterTag = "under-30" | "spicy" | "comfort-food" | "low-carb";

export const FILTER_LABELS: Record<FilterTag, string> = {
  "under-30": "Under 30 mins",
  "spicy": "Spicy",
  "comfort-food": "Comfort food",
  "low-carb": "Low carb",
};
