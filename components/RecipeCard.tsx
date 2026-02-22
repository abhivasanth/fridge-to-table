import Link from "next/link";
import type { Recipe } from "@/types/recipe";

const difficultyColours = {
  easy: "bg-[#C8DFC8] text-[#1A3A2A]",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
};

type RecipeCardProps = {
  recipe: Recipe;
  recipeSetId: string;
  recipeIndex: number;
};

export function RecipeCard({ recipe, recipeSetId, recipeIndex }: RecipeCardProps) {
  return (
    <Link
      href={`/recipe/${recipeSetId}/${recipeIndex}`}
      className="block group h-full"
    >
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6
                   hover:shadow-md transition-shadow duration-200 h-full flex flex-col"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-[#1A3A2A] bg-[#C8DFC8] px-2 py-1 rounded-full">
            {recipe.cuisineType}
          </span>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColours[recipe.difficulty]}`}
          >
            {recipe.difficulty}
          </span>
        </div>

        <h3
          className="text-lg font-semibold text-[#1A3A2A] mb-2
                     group-hover:text-[#D4622A] transition-colors"
        >
          {recipe.title}
        </h3>

        <p className="text-gray-500 text-sm mb-4 flex-1 line-clamp-2">
          {recipe.description}
        </p>

        <div className="flex items-center gap-1 text-gray-400 text-sm">
          <span>⏱</span>
          <span>{recipe.cookingTime} min</span>
        </div>
      </div>
    </Link>
  );
}
