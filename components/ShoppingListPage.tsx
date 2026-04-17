"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import type { Id } from "@/convex/_generated/dataModel";

export function ShoppingListPage() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const items = useQuery(
    api.shoppingList.getShoppingListItems,
    userId ? { userId } : "skip"
  );
  const addItem = useMutation(api.shoppingList.addToShoppingList);
  const removeItem = useMutation(api.shoppingList.removeFromShoppingList);

  const [inputValue, setInputValue] = useState("");
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [dupMessage, setDupMessage] = useState<string | null>(null);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    };
  }, []);

  const submitItem = useCallback(async () => {
    const name = inputValue.trim();
    if (!name || !userId) return;

    const result = await addItem({ userId, name });

    if (result.alreadyExists) {
      setInputValue("");
      setHighlightId(result.existingId as string);
      setDupMessage(`${name} is already on your list`);

      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
      dupTimerRef.current = setTimeout(() => {
        setHighlightId(null);
        setDupMessage(null);
      }, 3000);
    } else {
      setInputValue("");
    }
  }, [inputValue, userId, addItem]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") submitItem();
    },
    [submitItem]
  );

  const handleRemove = useCallback(
    async (itemId: Id<"shoppingListItems">) => {
      setRemovingIds((prev) => new Set(prev).add(itemId));
      // Wait for animation
      setTimeout(async () => {
        await removeItem({ id: itemId });
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(itemId);
          return next;
        });
      }, 300);
    },
    [removeItem]
  );

  const itemCount = items?.length ?? 0;

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block"
        >
          &larr; Back to search
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1
            className="font-medium text-[#2C2C2A]"
            style={{ fontSize: "18px" }}
          >
            My shopping list
          </h1>
          {itemCount > 0 && (
            <span
              className="bg-[#F0EBE3] text-[#888780] rounded-full px-3 py-0.5"
              style={{ fontSize: "13px" }}
            >
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          )}
        </div>

        {/* Items list or empty state */}
        {items !== undefined && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <span className="text-5xl opacity-30 mb-4" role="img" aria-label="shopping cart">
              🛒
            </span>
            <p className="text-[#888780] text-center" style={{ fontSize: "14px" }}>
              Your shopping list is empty.
              <br />
              Add items from recipes or type them in below.
            </p>
          </div>
        ) : (
          <ul className="space-y-1 mb-6">
            {items?.map((item) => {
              const isRemoving = removingIds.has(item._id);
              const isHighlighted = highlightId === item._id;
              return (
                <li
                  key={item._id}
                  className={`flex items-center justify-between py-2 px-3 transition-all duration-300 rounded-lg ${
                    isHighlighted ? "bg-[#BA7517]/5" : ""
                  }`}
                  style={{
                    opacity: isRemoving ? 0 : 1,
                    transform: isRemoving ? "translateX(-4px)" : "translateX(0)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#B4B2A9]">&bull;</span>
                    <span
                      className="text-[#2C2C2A]"
                      style={{ fontSize: "15px" }}
                    >
                      {item.name}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleRemove(item._id as Id<"shoppingListItems">)
                    }
                    className="text-[#888780] hover:text-[#D4622A] transition-colors"
                    style={{ fontSize: "12px" }}
                  >
                    remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Dedup feedback message */}
        {dupMessage && (
          <p
            className="text-[#888780] mb-2 transition-opacity duration-300"
            style={{ fontSize: "13px" }}
          >
            {dupMessage}
          </p>
        )}

        {/* Add item input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add an item..."
            className="flex-1 bg-white border border-[#E8E3D0] rounded-lg px-4 py-2.5 text-sm text-[#2C2C2A] placeholder-[#B4B2A9] focus:outline-none focus:border-[#BA7517] transition-colors"
          />
          <button
            type="button"
            onClick={submitItem}
            disabled={!inputValue.trim()}
            className="px-4 py-2.5 bg-[#BA7517] text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-opacity hover:bg-[#A06410] cursor-pointer"
          >
            Add
          </button>
        </div>
      </div>
    </main>
  );
}
