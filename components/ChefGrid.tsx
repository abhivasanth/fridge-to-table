"use client";
// Multi-select grid of chefs for the Chef's Table tab.
// Renders default chefs with emoji, custom chefs with thumbnail.
import Link from "next/link";
import type { ChefSlot } from "@/lib/chefs";

type Props = {
  chefs: ChefSlot[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ChefGrid({ chefs, selectedIds, onChange }: Props) {
  function toggle(chefId: string) {
    if (selectedIds.includes(chefId)) {
      onChange(selectedIds.filter((id) => id !== chefId));
    } else {
      onChange([...selectedIds, chefId]);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[#1A3A2A]">Choose your chefs</p>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <span className="text-xs text-[#D4622A] font-medium">
              {selectedIds.length} selected
            </span>
          )}
          <Link
            href="/my-chefs"
            className="text-xs text-[#D4622A] font-medium hover:underline"
          >
            Edit chefs
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {chefs.map((chef) => {
          const isSelected = selectedIds.includes(chef.id);
          return (
            <button
              key={chef.id}
              type="button"
              onClick={() => toggle(chef.id)}
              className={`flex items-center gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
                isSelected
                  ? "border-[#D4622A] bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              {chef.thumbnail ? (
                <img
                  src={chef.thumbnail}
                  alt={chef.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="text-2xl flex-shrink-0">{chef.emoji}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A3A2A] truncate">{chef.name}</p>
                {chef.country && (
                  <p className="text-xs text-gray-400">{chef.country}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {chefs.length === 0 && (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 mb-2">No chefs selected for Chef&apos;s Table</p>
          <Link href="/my-chefs" className="text-xs text-[#D4622A] font-medium hover:underline">
            Add chefs
          </Link>
        </div>
      )}
      {chefs.length > 0 && selectedIds.length === 0 && (
        <p className="text-xs text-gray-400 text-center pt-1">
          Select at least one chef to search
        </p>
      )}
    </div>
  );
}
