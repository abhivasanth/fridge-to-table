"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import type { RecipeFilters } from "@/types/recipe";

// Default filters used when the user doesn't open the filters panel
const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
  diet: "vegetarian",
};

export default function HomePage() {
  const router = useRouter();
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Convex actions — these run server-side in Convex, calling Claude
  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    setIsLoading(true);
    setError(null);

    try {
      let finalIngredients = ingredients;

      // Photo mode: use Claude vision to extract ingredients from the image first
      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });

        if (photoResult.ingredients.length === 0) {
          setError(
            "We couldn't detect many ingredients — try typing them instead."
          );
          setIsLoading(false);
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      // Generate 3 recipes and navigate to the results page
      const recipeSetId = await generateRecipes({
        sessionId: getSessionId(),
        ingredients: finalIngredients,
        filters,
      });

      router.push(`/results/${recipeSetId}`);
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            🥦 Fridge to Table
          </h1>
          <p className="text-gray-500 text-lg">
            Tell us what&apos;s in your fridge — we&apos;ll find something delicious.
          </p>
        </div>

        {/* Ingredient input (text or photo) */}
        <IngredientInput
          onSubmit={handleSubmit}
          isLoading={isLoading}
          diet={filters.diet}
          onDietChange={(diet) => setFilters((f) => ({ ...f, diet }))}
        />

        {/* Optional filters */}
        <FiltersPanel filters={filters} onChange={setFilters} />

        {/* Error message */}
        {error && (
          <div className="w-full max-w-xl bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center">
            <p className="text-5xl animate-bounce">👨‍🍳</p>
            <p className="text-gray-400 mt-2 text-sm">
              Finding your recipes...
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
