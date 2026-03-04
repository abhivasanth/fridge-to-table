"use client";
import { useState } from "react";
import { FILTER_LABELS, type FilterTag } from "@/types/v3";

const ALL_FILTERS: FilterTag[] = ["under-30", "spicy", "comfort-food", "low-carb"];

type Props = {
  activeFilters: FilterTag[];
  onChange: (filters: FilterTag[]) => void;
};

export function FilterPills({ activeFilters, onChange }: Props) {
  const [open, setOpen] = useState(false);

  function toggle(tag: FilterTag) {
    if (activeFilters.includes(tag)) {
      onChange(activeFilters.filter((f) => f !== tag));
    } else {
      onChange([...activeFilters, tag]);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-gray-400 hover:text-[#2D6A4F] flex items-center gap-1 transition-colors"
      >
        <span>{open ? "▲" : "▾"}</span>
        <span>Filters (optional)</span>
        {activeFilters.length > 0 && (
          <span style={{
            background: "#D4622A", color: "white",
            borderRadius: "10px", padding: "1px 7px", fontSize: "11px", fontWeight: 600,
          }}>
            {activeFilters.length}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 mt-2">
          {ALL_FILTERS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              style={{
                padding: "6px 14px", borderRadius: "100px", fontSize: "12px",
                fontWeight: 500, border: "1.5px solid",
                borderColor: activeFilters.includes(tag) ? "#D4622A" : "#E8E0D8",
                background: activeFilters.includes(tag) ? "rgba(212, 96, 44, 0.08)" : "white",
                color: activeFilters.includes(tag) ? "#D4622A" : "#6b7280",
                cursor: "pointer", transition: "all 0.15s ease",
              }}
            >
              {FILTER_LABELS[tag]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
