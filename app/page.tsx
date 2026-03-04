"use client";
import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppHeader } from "@/components/v3/AppHeader";
import { ResultsArea } from "@/components/v3/ResultsArea";
import { InputArea } from "@/components/v3/InputArea";
import type { ChefSlot } from "@/types/v3";
import { loadChefSlots } from "@/lib/chefSlots";

type AppMode = "empty" | "loading-recipes" | "loading-chefs" | "recipes" | "chefs";

export default function HomePage() {
  const [mode, setMode] = useState<AppMode>("empty");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chefSlots, setChefSlots] = useState<ChefSlot[]>(() => {
    if (typeof window === "undefined") return [];
    return loadChefSlots();
  });
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);

  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);
  const searchChefVideos = useAction(api.chefs.searchChefVideos);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    // will be wired in Tasks 6 + 8
  }

  return (
    <div className="h-dvh flex flex-col bg-[#FAF6F1] overflow-hidden">
      <AppHeader onHamburgerClick={() => setSidebarOpen(true)} />
      <ResultsArea>
        {/* Results rendered here in Tasks 6–9 */}
      </ResultsArea>
      <InputArea
        onSubmit={handleSubmit}
        isLoading={mode === "loading-recipes" || mode === "loading-chefs"}
        disabled={false}
      >
        {/* ChefSlotsGrid + Filters added in Tasks 5–7 */}
      </InputArea>
    </div>
  );
}
