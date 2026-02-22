"use client";
// Multi-select grid of celebrity chefs for the Chef's Table tab.
// Selections are controlled by parent (stored in localStorage via app/page.tsx).
import { CHEFS } from "@/lib/chefs";

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export function ChefGrid({ selectedIds, onChange }: Props) {
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
        {selectedIds.length > 0 && (
          <span className="text-xs text-[#D4622A] font-medium">
            {selectedIds.length} selected
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {CHEFS.map((chef) => {
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
              <span className="text-2xl flex-shrink-0">{chef.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1A3A2A] truncate">{chef.name}</p>
                <p className="text-xs text-gray-400">{chef.country}</p>
              </div>
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-xs text-gray-400 text-center pt-1">
          Select at least one chef to search
        </p>
      )}
    </div>
  );
}
