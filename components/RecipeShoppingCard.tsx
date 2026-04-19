"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthedUser } from "@/hooks/useAuthedUser";
import { api } from "@/convex/_generated/api";
import { normalizeName } from "@/lib/pantryUtils";
import { parseIngredientNames } from "@/lib/ingredientNameParser";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  shoppingList: string[];
};

type OptimisticState = "pantry" | "shopping" | null;

export function RecipeShoppingCard({ shoppingList }: Props) {
  const { user, isReady } = useAuthedUser();

  const pantryItems = useQuery(
    api.pantry.getPantryItems,
    isReady ? {} : "skip"
  );
  const shoppingItems = useQuery(
    api.shoppingList.getShoppingListItems,
    isReady ? {} : "skip"
  );

  const addToPantry = useMutation(api.pantry.addToPantry);
  const addToShoppingList = useMutation(api.shoppingList.addToShoppingList);
  const removeFromShoppingList = useMutation(
    api.shoppingList.removeFromShoppingList
  );

  // Optimistic state keyed by normalized name
  const [optimistic, setOptimistic] = useState<
    Map<string, OptimisticState>
  >(new Map());

  // Build lookup maps: normalizedName -> _id
  const pantryMap = useMemo(() => {
    const m = new Map<string, Id<"pantryItems">>();
    if (pantryItems) {
      for (const item of pantryItems) {
        m.set(item.normalizedName, item._id);
      }
    }
    return m;
  }, [pantryItems]);

  const shoppingMap = useMemo(() => {
    const m = new Map<string, Id<"shoppingListItems">>();
    if (shoppingItems) {
      for (const item of shoppingItems) {
        m.set(item.normalizedName, item._id);
      }
    }
    return m;
  }, [shoppingItems]);

  const clearOptimistic = useCallback((key: string) => {
    setOptimistic((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const handleAddToShopping = useCallback(
    async (normalizedNames: string[], ingredientNames: string[]) => {
      if (!user) return;
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, "shopping");
        return next;
      });
      try {
        await Promise.all(
          ingredientNames.map((name) =>
            addToShoppingList({ name, source: "recipe" })
          )
        );
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [user, addToShoppingList, clearOptimistic]
  );

  const handleRemoveFromShopping = useCallback(
    async (normalizedNames: string[]) => {
      if (!user) return;
      const ids = normalizedNames
        .map((n) => shoppingMap.get(n))
        .filter(Boolean);
      if (ids.length === 0) return;
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, null);
        return next;
      });
      try {
        await Promise.all(ids.map((id) => removeFromShoppingList({ id: id! })));
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [user, shoppingMap, removeFromShoppingList, clearOptimistic]
  );

  const handleAddToPantry = useCallback(
    async (normalizedNames: string[], ingredientNames: string[]) => {
      if (!user) return;
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, "pantry");
        return next;
      });
      try {
        await Promise.all(
          ingredientNames.map((name) =>
            addToPantry({ name })
          )
        );
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [user, addToPantry, clearOptimistic]
  );

  // Compute state for each item and filter out pantry items
  const itemsWithState = useMemo(() => {
    return shoppingList
      .map((rawItem, i) => {
        const ingredientNames = parseIngredientNames(rawItem);
        const normalizedNames = ingredientNames.map(normalizeName);
        const displayLabel = ingredientNames.join(" and ");

        // Determine state: optimistic first, then backend
        const hasOptimistic = normalizedNames.some(
          (n) => optimistic.get(n) !== undefined
        );

        let state: "default" | "in-shopping" | "in-pantry";

        if (hasOptimistic) {
          if (normalizedNames.every((n) => optimistic.get(n) === "shopping"))
            state = "in-shopping";
          else if (
            normalizedNames.every((n) => optimistic.get(n) === "pantry")
          )
            state = "in-pantry";
          else state = "default";
        } else if (normalizedNames.every((n) => pantryMap.has(n))) {
          state = "in-pantry";
        } else if (normalizedNames.some((n) => shoppingMap.has(n))) {
          state = "in-shopping";
        } else {
          state = "default";
        }

        return { rawItem, ingredientNames, normalizedNames, displayLabel, state, index: i };
      })
      .filter((item) => item.state !== "in-pantry");
  }, [shoppingList, optimistic, pantryMap, shoppingMap]);

  // Hide the entire card if no items remain after filtering
  if (shoppingList.length === 0 || itemsWithState.length === 0) return null;

  return (
    <section className="bg-amber-50 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
        🛒 Shopping List
      </h2>
      <ul className="space-y-1">
        {itemsWithState.map(({ rawItem, ingredientNames, normalizedNames, displayLabel, state, index }) => (
          <li
            key={index}
            className="text-sm flex items-center gap-2 py-1"
          >
            {/* Left icon/button */}
            {state === "default" && (
              <button
                onClick={() =>
                  handleAddToShopping(normalizedNames, ingredientNames)
                }
                className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center cursor-pointer"
                style={{ fontSize: "18px" }}
                aria-label={`Add ${displayLabel} to shopping list`}
              >
                +
              </button>
            )}
            {state === "in-shopping" && (
              <button
                onClick={() => handleRemoveFromShopping(normalizedNames)}
                className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center cursor-pointer"
                style={{ fontSize: "18px" }}
                aria-label={`Remove ${displayLabel} from shopping list`}
              >
                ✓
              </button>
            )}

            {/* Center: item text */}
            <span className="flex-1 text-gray-700">
              {rawItem}
            </span>

            {/* Right action */}
            {state === "default" && (
              <button
                onClick={() =>
                  handleAddToPantry(normalizedNames, ingredientNames)
                }
                className="text-[#0F6E56] flex-shrink-0 cursor-pointer"
                style={{ fontSize: "12px" }}
              >
                already have it
              </button>
            )}
            {state === "in-shopping" && (
              <span
                className="text-[#BA7517] flex-shrink-0"
                style={{ fontSize: "12px" }}
              >
                added to list
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
