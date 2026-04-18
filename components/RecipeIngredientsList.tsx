"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { normalizeName } from "@/lib/pantryUtils";
import { parseIngredientNames } from "@/lib/ingredientNameParser";

type Ingredient = {
  name: string;
  amount: string;
  inFridge: boolean;
};

type Props = {
  ingredients: Ingredient[];
};

export function RecipeIngredientsList({ ingredients }: Props) {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const pantryItems = useQuery(
    api.pantry.getPantryItems,
    userId ? { userId } : "skip"
  );

  // Build a set of normalized pantry names for quick lookup
  const pantryNames = new Set<string>();
  if (pantryItems) {
    for (const item of pantryItems) {
      pantryNames.add(item.normalizedName);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
        Ingredients
      </h2>
      <ul className="space-y-2">
        {ingredients.map((ing, i) => {
          const splitNames = parseIngredientNames(ing.name);
          const normalizedParts = splitNames.map(normalizeName);
          const isUserInput = ing.inFridge === true;
          const isInPantry =
            !isUserInput &&
            normalizedParts.length > 0 &&
            normalizedParts.every((n) => pantryNames.has(n));
          const isMissing = !isUserInput && !isInPantry;

          let iconBg: string;
          let iconText: string;
          let icon: string;
          let textClass: string;

          if (isUserInput) {
            iconBg = "bg-[#C8DFC8]";
            iconText = "text-[#1A3A2A]";
            icon = "\u2713"; // ✓
            textClass = "text-gray-800";
          } else if (isInPantry) {
            iconBg = "bg-[#C8DFC8]";
            iconText = "text-[#0F6E56]";
            icon = "\u2022"; // •
            textClass = "text-gray-800";
          } else {
            iconBg = "bg-gray-100";
            iconText = "text-gray-400";
            icon = "\u25CB"; // ○
            textClass = "text-gray-400";
          }

          return (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${iconBg} ${iconText}`}
              >
                {icon}
              </span>
              <span className={textClass}>
                <strong>{ing.amount}</strong> {ing.name}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
