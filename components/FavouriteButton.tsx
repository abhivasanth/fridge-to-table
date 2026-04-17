"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  recipeSetId: string;
  recipeIndex: number;
};

// Heart button that toggles a recipe's saved state.
// Uses Convex's real-time query — the button updates instantly after clicking.
export function FavouriteButton({ recipeSetId, recipeIndex }: Props) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const favourites = useQuery(api.favourites.getFavourites, userId ? { userId } : "skip");
  const saveFavourite = useMutation(api.favourites.saveFavourite);
  const removeFavourite = useMutation(api.favourites.removeFavourite);

  const isFavourited = favourites?.some(
    (f) => f.recipeSetId === recipeSetId && f.recipeIndex === recipeIndex
  );

  async function handleToggle() {
    const id = recipeSetId as Id<"recipes">;
    if (isFavourited) {
      await removeFavourite({ userId, recipeSetId: id, recipeIndex });
    } else {
      await saveFavourite({ userId, recipeSetId: id, recipeIndex });
    }
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={isFavourited ? "Remove from favourites" : "Save to favourites"}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm
                  border transition-colors
                  ${
                    isFavourited
                      ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100"
                      : "bg-white border-gray-200 text-gray-600 hover:border-green-400 hover:text-green-700"
                  }`}
    >
      <span>{isFavourited ? "♥" : "♡"}</span>
      <span>{isFavourited ? "Saved" : "Save to Favourites"}</span>
    </button>
  );
}
