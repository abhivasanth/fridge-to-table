"use client";
import { useState } from "react";
import type { RecipeFilters } from "@/types/recipe";

type Props = {
  filters: RecipeFilters;
  onChange: (filters: RecipeFilters) => void;
};

// Collapsible panel for optional search filters.
// Cuisine is free-text — it feeds directly into the Claude prompt as natural language.
export function FiltersPanel({ filters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full max-w-xl">
      {/* Toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-gray-400 hover:text-green-700 flex items-center gap-1 transition-colors"
      >
        <span>{open ? "▲" : "▼"}</span>
        <span>{open ? "Hide filters" : "Add filters (optional)"}</span>
      </button>

      {open && (
        <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-4 border border-gray-100">
          {/* Cuisine mood */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Cuisine / mood
            </label>
            <input
              type="text"
              value={filters.cuisine}
              onChange={(e) => onChange({ ...filters, cuisine: e.target.value })}
              placeholder='e.g. Italian, spicy, comfort food, "impress guests"'
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Max cooking time */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Max cooking time
            </label>
            <div className="flex gap-2">
              {([15, 30, 45, 60] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange({ ...filters, maxCookingTime: t })}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors
                    ${filters.maxCookingTime === t
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                    }`}
                >
                  {t === 60 ? "60+ m" : `${t} m`}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Difficulty
            </label>
            <div className="flex gap-2">
              {(["easy", "medium", "hard"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => onChange({ ...filters, difficulty: d })}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors
                    ${filters.difficulty === d
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
                    }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
