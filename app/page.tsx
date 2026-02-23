"use client";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChefGrid } from "@/components/ChefGrid";
import { getSelectedChefs } from "@/lib/chefs";
import type { RecipeFilters } from "@/types/recipe";

type ActiveTab = "any-recipe" | "chefs-table";

const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

const SELECTED_CHEFS_KEY = "fridgeToTable_selectedChefs";

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("any-recipe");
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load saved chef selections from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
    if (saved) {
      try {
        setSelectedChefIds(JSON.parse(saved));
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  function handleChefSelectionChange(ids: string[]) {
    setSelectedChefIds(ids);
    localStorage.setItem(SELECTED_CHEFS_KEY, JSON.stringify(ids));
  }

  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);
  const searchChefVideos = useAction(api.chefs.searchChefVideos);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    setIsLoading(true);
    setError(null);

    try {
      let finalIngredients = ingredients;

      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });
        if (photoResult.ingredients.length === 0) {
          setError("We couldn't detect many ingredients — try typing them instead.");
          setIsLoading(false);
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      if (activeTab === "chefs-table") {
        const selectedChefs = getSelectedChefs(selectedChefIds);
        const results = await searchChefVideos({
          ingredients: finalIngredients,
          chefs: selectedChefs.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            youtubeChannelId: c.youtubeChannelId,
          })),
        });
        localStorage.setItem("chefTableResults", JSON.stringify(results));
        router.push("/chef-results");
      } else {
        const sessionId = getSessionId();
        const recipeSetId = await generateRecipes({
          sessionId,
          ingredients: finalIngredients,
          filters,
        });
        router.push(`/results/${recipeSetId}`);
      }
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  const chefsTableDisabled = activeTab === "chefs-table" && selectedChefIds.length === 0;

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#1A3A2A]">
            What&apos;s in your <em>fridge?</em>
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Tell us your ingredients and we&apos;ll find the perfect recipe.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 bg-white rounded-2xl p-1 mb-6 shadow-sm">
          {(["any-recipe", "chefs-table"] as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-[#D4622A] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab === "any-recipe" ? "Any Recipe" : "Chef's Table 🍽️"}
            </button>
          ))}
        </div>

        {/* Chef grid — only on Chef's Table tab */}
        {activeTab === "chefs-table" && (
          <div className="mb-6">
            <ChefGrid
              selectedIds={selectedChefIds}
              onChange={handleChefSelectionChange}
            />
          </div>
        )}

        {/* Ingredient input — filters passed as beforeSubmit slot */}
        <IngredientInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          disabled={chefsTableDisabled}
          beforeSubmit={
            activeTab === "any-recipe" ? (
              <FiltersPanel filters={filters} onChange={setFilters} />
            ) : undefined
          }
        />

        {/* Error message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex justify-between items-start">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 ml-3 flex-shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
