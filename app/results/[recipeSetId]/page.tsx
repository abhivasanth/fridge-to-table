import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { RecipeCard } from "@/components/RecipeCard";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ recipeSetId: string }>;
};

// Server component — fetches data before rendering (no loading spinner needed)
export default async function ResultsPage({ params }: Props) {
  const { recipeSetId } = await params;
  const recipeSet = await fetchQuery(api.recipes.getRecipeSet, {
    recipeSetId: recipeSetId as Id<"recipes">,
  });

  if (!recipeSet) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF6F1]">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Recipe set not found.</p>
          <Link href="/" className="text-[#D4622A] underline">
            Start a new search
          </Link>
        </div>
      </main>
    );
  }

  const recipes = recipeSet.results as Recipe[];

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-[#D4622A] text-sm hover:underline mb-4 inline-block"
          >
            ← New search
          </Link>
          <h2 className="text-2xl font-bold text-[#1A3A2A]">
            Here&apos;s what we found
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Based on: {recipeSet.ingredients.join(", ")}
          </p>
        </div>

        {/* 3 recipe cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe, index) => (
            <RecipeCard
              key={index}
              recipe={recipe}
              recipeSetId={recipeSetId}
              recipeIndex={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
