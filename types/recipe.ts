// Recipe type used in both the frontend (components) and backend (Convex).
// Must be kept in sync with the prompt schema sent to Claude.
export type Recipe = {
  title: string;
  description: string;          // 1-2 sentence hook shown on recipe card
  cookingTime: number;          // estimated cooking time in minutes
  difficulty: "easy" | "medium" | "hard";
  servings: number;
  cuisineType: string;          // e.g. "Italian", "Indian", "Mediterranean"
  ingredients: {
    name: string;
    amount: string;             // e.g. "200g", "3 large", "a handful"
    inFridge: boolean;          // true = user already has this ingredient
  }[];
  steps: string[];              // ordered cooking instructions
  shoppingList: string[];       // ingredients the user needs to buy
  uncertainIngredients?: string[]; // flagged if photo analysis was uncertain
};

// Filters the user can apply when searching for recipes
// diet is intentionally removed — Claude infers dietary requirements from ingredients
export type RecipeFilters = {
  cuisine: string;              // free-text — feeds directly into the Claude prompt
  maxCookingTime: number;       // minutes
  difficulty: "easy" | "medium" | "hard";
};

export type ChefVideoResult = {
  chefId: string;
  chefName: string;
  chefEmoji: string;
  found: boolean;
  videos: {
    title: string;
    thumbnail: string;
    videoId: string;
  }[];
};

export type HistoryEntry = {
  id: string;
  query: string;
  timestamp: number;
  resultType: "recipes" | "chefs";
  recipeSetId?: string;
  videoResults?: ChefVideoResult[];
  pinned?: boolean;
};
