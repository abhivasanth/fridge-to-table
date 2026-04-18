"use client";
import { useQuery, useMutation } from "convex/react";
import { useAuthedUser } from "@/hooks/useAuthedUser";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

// Loads and renders the user's saved recipes.
// Uses Convex's real-time query — removes appear instantly without a page refresh.
export function FavouritesGrid() {
  const { isReady } = useAuthedUser();
  // `undefined` while loading, `[]` when loaded but empty
  const favourites = useQuery(
    api.favourites.getFavourites,
    isReady ? {} : "skip"
  );
  const removeFavourite = useMutation(api.favourites.removeFavourite);

  if (favourites === undefined) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl animate-pulse">🥦</p>
        <p className="text-gray-400 mt-2">Loading your favourites...</p>
      </div>
    );
  }

  if (favourites.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-5xl mb-4">🍽️</p>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          No favourites yet
        </h3>
        <p className="text-gray-400 mb-6">Save recipes you love while cooking!</p>
        <Link
          href="/"
          className="inline-block bg-[#D4622A] text-white px-6 py-3 rounded-2xl
                     font-medium hover:bg-[#BF5525] transition-colors"
        >
          Find recipes
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {favourites.map((fav) => (
        <FavouriteCard
          key={fav._id}
          recipeSetId={fav.recipeSetId}
          recipeIndex={fav.recipeIndex}
          onRemove={() =>
            removeFavourite({
              recipeSetId: fav.recipeSetId as Id<"recipes">,
              recipeIndex: fav.recipeIndex,
            })
          }
        />
      ))}
    </div>
  );
}

// Individual card that fetches its own recipe data from Convex
function FavouriteCard({
  recipeSetId,
  recipeIndex,
  onRemove,
}: {
  recipeSetId: string;
  recipeIndex: number;
  onRemove: () => void;
}) {
  const recipeSet = useQuery(api.recipes.getRecipeSet, {
    recipeSetId: recipeSetId as Id<"recipes">,
  });

  if (!recipeSet) return null;

  const recipe = (recipeSet.results as Recipe[])[recipeIndex];
  if (!recipe) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
      {/* Remove button */}
      <button
        onClick={onRemove}
        aria-label="Remove from favourites"
        className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors text-lg"
      >
        ♥
      </button>

      <Link href={`/recipe/${recipeSetId}/${recipeIndex}`}>
        <span className="text-xs font-medium text-[#1A3A2A] bg-[#C8DFC8] px-2 py-1 rounded-full">
          {recipe.cuisineType}
        </span>
        <h3 className="text-base font-semibold text-[#1A3A2A] mt-2 mb-1 hover:text-[#D4622A] transition-colors">
          {recipe.title}
        </h3>
        <p className="text-gray-400 text-xs">⏱ {recipe.cookingTime} min</p>
      </Link>
    </div>
  );
}
