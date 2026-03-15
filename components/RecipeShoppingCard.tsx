"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { normalizeName } from "@/lib/pantryUtils";
import { parseIngredientName } from "@/lib/ingredientNameParser";
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
    async (normalized: string, ingredientName: string) => {
      setOptimistic((prev) => new Map(prev).set(normalized, "shopping"));
      try {
        await addToShoppingList({
          sessionId,
          name: ingredientName,
          source: "recipe",
        });
      } finally {
        clearOptimistic(normalized);
      }
    },
    [sessionId, addToShoppingList, clearOptimistic]
  );

  const handleRemoveFromShopping = useCallback(
    async (normalized: string) => {
      const id = shoppingMap.get(normalized);
      if (!id) return;
      setOptimistic((prev) => new Map(prev).set(normalized, null));
      try {
        await removeFromShoppingList({ id });
      } finally {
        clearOptimistic(normalized);
      }
    },
    [shoppingMap, removeFromShoppingList, clearOptimistic]
  );

  const handleAddToPantry = useCallback(
    async (normalized: string, ingredientName: string) => {
      setOptimistic((prev) => new Map(prev).set(normalized, "pantry"));
      try {
        await addToPantry({ sessionId, name: ingredientName });
      } finally {
        clearOptimistic(normalized);
      }
    },
    [sessionId, addToPantry, clearOptimistic]
  );

  const handleRemoveFromPantry = useCallback(
    async (normalized: string) => {
      const id = pantryMap.get(normalized);
      if (!id) return;
      setOptimistic((prev) => new Map(prev).set(normalized, null));
      try {
        await removeFromPantry({ id });
      } finally {
        clearOptimistic(normalized);
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
          const ingredientName = parseIngredientName(rawItem);
          const normalized = normalizeName(ingredientName);

          // Determine state: optimistic first, then backend
          const opt = optimistic.get(normalized);
          let state: "default" | "in-shopping" | "in-pantry";

          if (opt !== undefined) {
            if (opt === "shopping") state = "in-shopping";
            else if (opt === "pantry") state = "in-pantry";
            else state = "default";
          } else if (pantryMap.has(normalized)) {
            state = "in-pantry";
          } else if (shoppingMap.has(normalized)) {
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
                    handleAddToShopping(normalized, ingredientName)
                  }
                  className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center"
                  style={{ fontSize: "18px" }}
                  aria-label={`Add ${ingredientName} to shopping list`}
                >
                  +
                </button>
              )}
              {state === "in-shopping" && (
                <button
                  onClick={() => handleRemoveFromShopping(normalized)}
                  className="text-[#BA7517] font-bold flex-shrink-0 w-5 text-center"
                  style={{ fontSize: "18px" }}
                  aria-label={`Remove ${ingredientName} from shopping list`}
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
                    handleAddToPantry(normalized, ingredientName)
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
                  onClick={() => handleRemoveFromPantry(normalized)}
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
