"use client";
import { useState } from "react";
import type { Recipe } from "@/types/recipe";

const difficultyColours: Record<string, string> = {
  easy: "bg-[#C8DFC8] text-[#1A3A2A]",
  medium: "bg-amber-100 text-amber-800",
  hard: "bg-red-100 text-red-800",
};

type Stage = "closed" | "ingredients" | "full";

type Props = { recipe: Recipe };

export function ExpandableRecipeCard({ recipe }: Props) {
  const [stage, setStage] = useState<Stage>("closed");

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      style={{ transition: "all 0.2s ease" }}
    >
      {/* Card header — always visible, tap to toggle */}
      <button
        type="button"
        aria-label={recipe.title}
        onClick={() => setStage(stage === "closed" ? "ingredients" : "closed")}
        className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
        style={{ display: "block" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-medium text-[#1A3A2A] bg-[#C8DFC8] px-2 py-1 rounded-full">
            {recipe.cuisineType}
          </span>
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${difficultyColours[recipe.difficulty] ?? "bg-gray-100 text-gray-600"}`}>
            {recipe.difficulty}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-[#1A3A2A] mb-2">{recipe.title}</h3>
        <p className="text-gray-500 text-sm mb-4 line-clamp-2">{recipe.description}</p>
        <div className="flex items-center gap-1 text-gray-400 text-sm">
          <span>⏱</span>
          <span>{recipe.cookingTime} min</span>
        </div>
      </button>

      {/* Stage 1: Ingredients */}
      {stage !== "closed" && (
        <div className="px-6 pb-4 border-t border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">Ingredients</p>
          <ul className="space-y-1.5 mb-4">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span>{ing.inFridge ? "✅" : "○"}</span>
                <span style={{ color: ing.inFridge ? "#1A3A2A" : "#9ca3af" }}>
                  {ing.amount} {ing.name}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStage("full")}
            className="text-sm font-semibold text-[#D4622A] hover:underline"
          >
            View Full Recipe →
          </button>
        </div>
      )}

      {/* Stage 2: Full recipe (steps) */}
      {stage === "full" && (
        <div className="px-6 pb-6 border-t border-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-4 mb-3">Instructions</p>
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  style={{
                    width: "22px", height: "22px", borderRadius: "50%",
                    background: "#D4622A", color: "white", fontSize: "11px",
                    fontWeight: 700, display: "flex", alignItems: "center",
                    justifyContent: "center", flexShrink: 0, marginTop: "1px",
                  }}
                >
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => setStage("closed")}
            className="mt-4 text-sm text-gray-400 hover:text-gray-600"
          >
            Collapse
          </button>
        </div>
      )}
    </div>
  );
}
