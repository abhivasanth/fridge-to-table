"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { normalizeName } from "@/lib/pantryUtils";
import {
  parseIngredientName,
  parseIngredientNames,
} from "@/lib/ingredientNameParser";
import type { Id } from "@/convex/_generated/dataModel";

type Props = {
  shoppingList: string[];
};

type OptimisticState = "pantry" | "shopping" | null;

export function RecipeShoppingCard({ shoppingList }: Props) {
  const sessionId = getSessionId();

  const pantryItems = useQuery(
    api.pantry.getPantryItems,
    sessionId ? { sessionId } : "skip"
  );
  const shoppingItems = useQuery(
    api.shoppingList.getShoppingListItems,
    sessionId ? { sessionId } : "skip"
  );

  const addToPantry = useMutation(api.pantry.addToPantry);
  const removeFromPantry = useMutation(api.pantry.removeFromPantry);
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
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, "shopping");
        return next;
      });
      try {
        await Promise.all(
          ingredientNames.map((name) =>
            addToShoppingList({ sessionId, name, source: "recipe" })
          )
        );
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [sessionId, addToShoppingList, clearOptimistic]
  );

  const handleRemoveFromShopping = useCallback(
    async (normalizedNames: string[]) => {
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
    [shoppingMap, removeFromShoppingList, clearOptimistic]
  );

  const handleAddToPantry = useCallback(
    async (normalizedNames: string[], ingredientNames: string[]) => {
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, "pantry");
        return next;
      });
      try {
        await Promise.all(
          ingredientNames.map((name) =>
            addToPantry({ sessionId, name })
          )
        );
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [sessionId, addToPantry, clearOptimistic]
  );

  const handleRemoveFromPantry = useCallback(
    async (normalizedNames: string[]) => {
      const ids = normalizedNames
        .map((n) => pantryMap.get(n))
        .filter(Boolean);
      if (ids.length === 0) return;
      setOptimistic((prev) => {
        const next = new Map(prev);
        for (const n of normalizedNames) next.set(n, null);
        return next;
      });
      try {
        await Promise.all(ids.map((id) => removeFromPantry({ id: id! })));
      } finally {
        for (const n of normalizedNames) clearOptimistic(n);
      }
    },
    [pantryMap, removeFromPantry, clearOptimistic]
  );

  if (shoppingList.length === 0) return null;

  return (
    <section className="bg-amber-50 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-[#1A3A2A] mb-3">
        🛒 Shopping List
      </h2>
      <ul className="space-y-1">
        {shoppingList.map((rawItem, i) => {
          const ingredientNames = parseIngredientNames(rawItem);
          const normalizedNames = ingredientNames.map(normalizeName);

          // For display label in aria, join the parsed names
          const displayLabel = ingredientNames.join(" and ");

          // Determine state: optimistic first, then backend
          // Check if ANY part has an optimistic override
          const hasOptimistic = normalizedNames.some(
            (n) => optimistic.get(n) !== undefined
          );

          let state: "default" | "in-shopping" | "in-pantry";

          if (hasOptimistic) {
            // If all parts are optimistically "shopping"
            if (normalizedNames.every((n) => optimistic.get(n) === "shopping"))
              state = "in-shopping";
            // If all parts are optimistically "pantry"
            else if (
              normalizedNames.every((n) => optimistic.get(n) === "pantry")
            )
              state = "in-pantry";
            // Mixed or null → default
            else state = "default";
          } else if (normalizedNames.every((n) => pantryMap.has(n))) {
            state = "in-pantry";
          } else if (normalizedNames.some((n) => shoppingMap.has(n))) {
            state = "in-shopping";
          } else {
            state = "default";
          }

          return (
            <li
              key={i}
              className="text-sm flex items-center gap-2 py-1"
            >
              {/* Left icon/button */}
              {state === "default" && (
                <button
                  onClick={() =>
                    handleAddToShopping(normalizedNames, ingredientNames)
                  }
                  className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center"
                  style={{ fontSize: "18px" }}
                  aria-label={`Add ${displayLabel} to shopping list`}
                >
                  +
                </button>
              )}
              {state === "in-shopping" && (
                <button
                  onClick={() => handleRemoveFromShopping(normalizedNames)}
                  className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center"
                  style={{ fontSize: "18px" }}
                  aria-label={`Remove ${displayLabel} from shopping list`}
                >
                  ✓
                </button>
              )}
              {state === "in-pantry" && (
                <span
                  className="text-[#B4B2A9] font-bold flex-shrink-0 w-5 text-center"
                  style={{ fontSize: "18px" }}
                >
                  ·
                </span>
              )}

              {/* Center: item text */}
              <span
                className={`flex-1 ${
                  state === "in-pantry"
                    ? "line-through text-[#B4B2A9]"
                    : "text-gray-700"
                }`}
              >
                {rawItem}
              </span>

              {/* Right action */}
              {state === "default" && (
                <button
                  onClick={() =>
                    handleAddToPantry(normalizedNames, ingredientNames)
                  }
                  className="text-[#0F6E56] flex-shrink-0"
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
              {state === "in-pantry" && (
                <button
                  onClick={() => handleRemoveFromPantry(normalizedNames)}
                  className="text-[#888780] flex-shrink-0"
                  style={{ fontSize: "12px" }}
                >
                  undo
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
