"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useAuthedUser } from "@/hooks/useAuthedUser";
import { api } from "@/convex/_generated/api";
import { CATEGORY_ORDER, CATEGORY_LABELS } from "@/lib/pantryUtils";
import type { CategoryKey } from "@/lib/pantryUtils";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";

export function PantryPage() {
  const { user, isReady } = useAuthedUser();
  const pantryItems = useQuery(
    api.pantry.getPantryItems,
    isReady ? {} : "skip"
  );
  const addToPantry = useMutation(api.pantry.addToPantry);
  const removeFromPantry = useMutation(api.pantry.removeFromPantry);

  const [inputValue, setInputValue] = useState("");
  const [dupMessage, setDupMessage] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{
    id: Id<"pantryItems">;
    name: string;
  } | null>(null);

  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
      if (removeTimerRef.current) clearTimeout(removeTimerRef.current);
    };
  }, []);

  const handleAdd = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || !user) return;

    const result = await addToPantry({ name: trimmed });
    setInputValue("");

    if (result.alreadyExists) {
      // Show duplicate feedback
      const existingId = result.existingId as string;
      setHighlightId(existingId);
      setDupMessage(`${trimmed} is already in your pantry`);

      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
      dupTimerRef.current = setTimeout(() => {
        setHighlightId(null);
        setDupMessage("");
      }, 3000);
    }
  }, [inputValue, user, addToPantry]);

  const handleRemove = useCallback(
    (id: Id<"pantryItems">, name: string) => {
      // Cancel any existing pending remove
      if (removeTimerRef.current) {
        clearTimeout(removeTimerRef.current);
      }

      setPendingRemove({ id, name });

      removeTimerRef.current = setTimeout(() => {
        removeFromPantry({ id });
        setPendingRemove(null);
      }, 3000);
    },
    [removeFromPantry]
  );

  const handleUndo = useCallback(() => {
    if (removeTimerRef.current) {
      clearTimeout(removeTimerRef.current);
    }
    setPendingRemove(null);
  }, []);

  // Filter out the pending-remove item from display
  const visibleItems = pantryItems?.filter(
    (item) => !pendingRemove || item._id !== pendingRemove.id
  );

  // Group items by category
  const groupedItems = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      const items =
        visibleItems?.filter(
          (item) => (item.category as CategoryKey) === cat
        ) ?? [];
      if (items.length > 0) {
        acc.push({ category: cat, items });
      }
      return acc;
    },
    [] as {
      category: CategoryKey;
      items: NonNullable<typeof visibleItems>;
    }[]
  );

  const itemCount = visibleItems?.length ?? 0;

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block"
        >
          ← Back to search
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-[18px] font-medium text-[#2C2C2A]"
          >
            My pantry
          </h1>
          {itemCount > 0 && (
            <span className="bg-[#F0EBE3] text-[#888780] text-[13px] px-2.5 py-0.5 rounded-full">
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>
        <p className="text-[13px] text-[#888780] mb-6">
          Items here will show as already owned on recipe shopping lists
        </p>

        {/* Add item input */}
        <div className="flex gap-2 mb-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Add an item to your pantry..."
            className="flex-1 bg-white border border-[#E8E3D0] rounded-lg px-3 py-2 text-sm text-[#2C2C2A] placeholder-[#B4B2A9] focus:outline-none focus:border-[#0F6E56] transition-colors"
          />
          <button
            onClick={handleAdd}
            disabled={!inputValue.trim()}
            className="bg-[#1D9E75] text-white text-sm font-medium px-4 py-2 rounded-lg transition-opacity disabled:opacity-40"
          >
            Add
          </button>
        </div>

        {/* Duplicate message */}
        {dupMessage && (
          <p className="text-[13px] text-[#888780] mb-4">{dupMessage}</p>
        )}
        {!dupMessage && <div className="mb-4" />}

        {/* Items display */}
        {itemCount === 0 && pantryItems !== undefined ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl opacity-30 mb-4">🫙</span>
            <p className="text-[14px] text-[#888780] max-w-xs">
              Your pantry is empty. Add items from any recipe&apos;s shopping
              list or type them in above.
            </p>
          </div>
        ) : (
          /* Grouped items */
          <div className="space-y-5">
            {groupedItems.map(({ category, items }) => (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[13px] uppercase tracking-wider text-[#888780] whitespace-nowrap">
                    {CATEGORY_LABELS[category]}
                  </span>
                  <div className="flex-1 h-px bg-[#E8E3D0]" />
                </div>
                {/* Item pills */}
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item._id}
                      className={`inline-flex items-center bg-white border border-[#E8E3D0] rounded-full px-3.5 py-1.5 text-sm text-[#2C2C2A] transition-all duration-300 ${
                        highlightId === item._id
                          ? "ring-2 ring-[#0F6E56]/30 bg-[#0F6E56]/5"
                          : ""
                      }`}
                    >
                      {item.name}
                      <button
                        onClick={() =>
                          handleRemove(
                            item._id as Id<"pantryItems">,
                            item.name
                          )
                        }
                        className="ml-2 text-[#B4B2A9] hover:text-[#888780] transition-colors leading-none cursor-pointer"
                        aria-label={`Remove ${item.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer info box */}
        {itemCount > 0 && (
          <div className="bg-[#F0EBE3] rounded-xl p-4 mt-8">
            <p className="text-[13px] text-[#888780]">
              Items in your pantry are automatically shown as owned on recipe
              shopping lists. You can also add items directly from any
              recipe&apos;s shopping list.
            </p>
          </div>
        )}
      </div>

      {/* Remove undo toast */}
      {pendingRemove && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#2C2C2A] text-white rounded-xl shadow-lg px-5 py-3 flex items-center gap-3 text-sm z-50">
          <span>Removed &ldquo;{pendingRemove.name}&rdquo;</span>
          <button
            onClick={handleUndo}
            className="text-[#1D9E75] font-medium hover:underline cursor-pointer"
          >
            Undo
          </button>
        </div>
      )}
    </main>
  );
}
