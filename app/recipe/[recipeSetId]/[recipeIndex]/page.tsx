import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { FavouriteButton } from "@/components/FavouriteButton";
import Link from "next/link";
import type { Recipe } from "@/types/recipe";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  params: Promise<{ recipeSetId: string; recipeIndex: string }>;
};

export default async function RecipeDetailPage({ params }: Props) {
  const { recipeSetId, recipeIndex: recipeIndexStr } = await params;
  const recipeSet = await fetchQuery(api.recipes.getRecipeSet, {
    recipeSetId: recipeSetId as Id<"recipes">,
  });

  const recipeIndex = parseInt(recipeIndexStr, 10);
  const recipe = recipeSet
    ? (recipeSet.results as Recipe[])[recipeIndex]
    : null;

  if (!recipe) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF6F1]">
        <p className="text-gray-500">
          Recipe not found.{" "}
          <Link href="/" className="text-[#D4622A] underline">
            Go home
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href={`/results/${recipeSetId}`}
          className="text-[#D4622A] text-sm hover:underline mb-6 inline-block"
        >
          ← Back to results
        </Link>

        {/* Uncertainty notice — shown only if photo analysis flagged items */}
        {recipe.uncertainIngredients && recipe.uncertainIngredients.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-amber-800 text-sm">
            <strong>Note:</strong> We assumed these were vegetarian but weren&apos;t
            certain: {recipe.uncertainIngredients.join(", ")}. Double-check
            before cooking!
          </div>
        )}

        {/* Title and favourite button */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-[#1A3A2A]">{recipe.title}</h1>
          <FavouriteButton
            recipeSetId={recipeSetId}
            recipeIndex={recipeIndex}
          />
        </div>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-2 mb-6 text-sm">
          <span className="bg-[#C8DFC8] text-[#1A3A2A] px-3 py-1 rounded-full font-medium">
            {recipe.cuisineType}
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            ⏱ {recipe.cookingTime} min
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
            👤 {recipe.servings} servings
          </span>
          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full capitalize">
            {recipe.difficulty}
          </span>
        </div>

        <p className="text-gray-600 mb-8">{recipe.description}</p>

        {/* Ingredients list */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
            Ingredients
          </h2>
          <ul className="space-y-2">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center
                    text-xs flex-shrink-0
                    ${ing.inFridge
                      ? "bg-[#C8DFC8] text-[#1A3A2A]"
                      : "bg-gray-100 text-gray-400"
                    }`}
                >
                  {ing.inFridge ? "✓" : "○"}
                </span>
                <span
                  className={ing.inFridge ? "text-gray-800" : "text-gray-400"}
                >
                  <strong>{ing.amount}</strong> {ing.name}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Step-by-step instructions */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
            Instructions
          </h2>
          <ol className="space-y-4">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-4 text-sm text-gray-700">
                <span
                  className="w-7 h-7 rounded-full bg-[#D4622A] text-white font-bold
                             flex items-center justify-center flex-shrink-0 text-xs"
                >
                  {i + 1}
                </span>
                <span className="pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Shopping list — only shown if there are items to buy */}
        {recipe.shoppingList.length > 0 && (
          <section className="bg-amber-50 rounded-xl p-5">
            <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
              🛒 Shopping List
            </h2>
            <ul className="space-y-1">
              {recipe.shoppingList.map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-gray-700 flex items-center gap-2"
                >
                  <span className="text-amber-500">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
