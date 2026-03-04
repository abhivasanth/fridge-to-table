"use client";
import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppHeader } from "@/components/v3/AppHeader";
import { ResultsArea } from "@/components/v3/ResultsArea";
import { InputArea } from "@/components/v3/InputArea";
import { ExpandableRecipeCard } from "@/components/v3/ExpandableRecipeCard";
import type { ChefSlot, FilterTag, HistoryEntry } from "@/types/v3";
import { loadChefSlots, saveChefSlots } from "@/lib/chefSlots";
import { ChefSlotsGrid } from "@/components/v3/ChefSlotsGrid";
import { InlineVideoCard } from "@/components/v3/InlineVideoCard";
import { saveHistoryEntry } from "@/lib/searchHistory";
import { CHEFS } from "@/lib/chefs";
import { getSessionId } from "@/lib/session";
import type { Recipe, ChefVideoResult } from "@/types/recipe";
import { Sidebar } from "@/components/v3/Sidebar";
import { FilterPills } from "@/components/v3/FilterPills";

type ResultState =
  | { type: "empty" }
  | { type: "loading"; mode: "recipes" | "chefs" }
  | { type: "recipes"; recipes: Recipe[]; query: string; recipeSetId: string }
  | { type: "chefs"; results: ChefVideoResult[]; query: string };

function buildConvexFilters(tags: FilterTag[]) {
  const cuisineParts: string[] = [];
  if (tags.includes("spicy")) cuisineParts.push("spicy");
  if (tags.includes("comfort-food")) cuisineParts.push("comfort food");
  if (tags.includes("low-carb")) cuisineParts.push("low carb");
  return {
    cuisine: cuisineParts.join(", "),
    maxCookingTime: tags.includes("under-30") ? 30 : 120,
    difficulty: "easy" as const,
  };
}

export default function HomePage() {
  const [result, setResult] = useState<ResultState>({ type: "empty" });
  const [pendingRecipeSetId, setPendingRecipeSetId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<FilterTag[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chefSlots, setChefSlots] = useState<ChefSlot[]>(() => {
    if (typeof window === "undefined") return [];
    return loadChefSlots();
  });
  const [selectedSlotIndices, setSelectedSlotIndices] = useState<number[]>([]);

  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);
  const searchChefVideos = useAction(api.chefs.searchChefVideos);
  const resolveYouTubeChannel = useAction(api.customChefs.resolveYouTubeChannel);

  const recipeSet = useQuery(
    api.recipes.getRecipeSet,
    pendingRecipeSetId ? { recipeSetId: pendingRecipeSetId as Id<"recipes"> } : "skip"
  );

  useEffect(() => {
    if (!pendingRecipeSetId || !recipeSet) return;
    const recipes = recipeSet.results as Recipe[];
    const query = recipeSet.ingredients.join(", ");
    setResult({ type: "recipes", recipes, query, recipeSetId: pendingRecipeSetId });
    saveHistoryEntry({
      id: pendingRecipeSetId,
      query,
      timestamp: Date.now(),
      resultType: "recipes",
      recipeSetId: pendingRecipeSetId,
    });
    setPendingRecipeSetId(null);
  }, [recipeSet, pendingRecipeSetId]);

  async function handleHistorySelect(entry: HistoryEntry) {
    if (entry.resultType === "recipes" && entry.recipeSetId) {
      try {
        const recipeSet = await fetchQuery(api.recipes.getRecipeSet, {
          recipeSetId: entry.recipeSetId as Id<"recipes">,
        });
        if (recipeSet) {
          setResult({
            type: "recipes",
            recipes: recipeSet.results as Recipe[],
            query: entry.query,
            recipeSetId: entry.recipeSetId,
          });
        }
      } catch {
        setResult({ type: "empty" });
      }
    } else if (entry.resultType === "chefs" && entry.videoResults) {
      setResult({ type: "chefs", results: entry.videoResults, query: entry.query });
    }
  }

  async function handleResolveChannel(url: string): Promise<{ channelId: string; channelName: string } | null> {
    const result = await resolveYouTubeChannel({ input: url });
    if (!result.ok) return null;
    return { channelId: result.channelId, channelName: result.channelName };
  }

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    const mode = selectedSlotIndices.length > 0 ? "chefs" : "recipes";
    setResult({ type: "loading", mode });
    setSelectedSlotIndices([]);

    try {
      let finalIngredients = ingredients;
      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });
        if (photoResult.ingredients.length === 0) {
          setResult({ type: "empty" });
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      if (mode === "recipes") {
        const filters = buildConvexFilters(activeFilters);
        const recipeSetId = await generateRecipes({
          sessionId: getSessionId(),
          ingredients: finalIngredients,
          filters,
        });
        setPendingRecipeSetId(recipeSetId as string);
        // useEffect above transitions to "recipes" state when data arrives
      }
      if (selectedSlotIndices.length > 0) {
        const query = finalIngredients.join(", ");
        // Build chef list from selected slots
        const chefsForSearch = selectedSlotIndices.map((idx) => {
          const slot = chefSlots[idx];
          if (slot.type === "preset") {
            const chef = CHEFS.find((c) => c.id === slot.chefId);
            if (!chef) return null;
            return { id: chef.id, name: chef.name, emoji: chef.emoji, youtubeChannelId: chef.youtubeChannelId };
          } else if (slot.type === "custom") {
            return { id: slot.channelId, name: slot.channelName, emoji: "📺", youtubeChannelId: slot.channelId };
          }
          return null;
        }).filter(Boolean) as { id: string; name: string; emoji: string; youtubeChannelId: string }[];

        if (chefsForSearch.length === 0) {
          setResult({ type: "empty" });
          return;
        }
        const videoResults = await searchChefVideos({ ingredients: finalIngredients, chefs: chefsForSearch });
        setResult({ type: "chefs", results: videoResults, query });
        saveHistoryEntry({
          id: crypto.randomUUID(),
          query,
          timestamp: Date.now(),
          resultType: "chefs",
          videoResults,
        });
      }
    } catch (err) {
      console.error("handleSubmit error:", err);
      setResult({ type: "empty" });
    }
  }

  return (
    <div className="h-dvh flex flex-col bg-[#FAF6F1] overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewSearch={() => { setResult({ type: "empty" }); setSelectedSlotIndices([]); }}
        onSelectHistory={handleHistorySelect}
      />
      <AppHeader onHamburgerClick={() => setSidebarOpen(true)} />
      <ResultsArea
        showBack={result.type !== "empty"}
        onBack={() => { setResult({ type: "empty" }); setSelectedSlotIndices([]); }}
      >
        {result.type === "loading" && (
          <div className="flex flex-col items-center justify-center min-h-[30vh] gap-3">
            <p className="text-2xl animate-bounce">🍳</p>
            <p className="text-gray-400 text-sm">
              {result.mode === "recipes" ? "Finding recipes..." : "Searching your chefs' videos..."}
            </p>
          </div>
        )}
        {result.type === "recipes" && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-4">✦ AI-Generated Recipes</p>
            <div className="space-y-4">
              {result.recipes.map((recipe, i) => (
                <ExpandableRecipeCard key={i} recipe={recipe} />
              ))}
            </div>
          </div>
        )}
        {result.type === "chefs" && (
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-1">✦ From Your Chefs</p>
            <p className="text-xs text-gray-400 mb-4">Videos matching your ingredients from selected chefs.</p>
            <div className="space-y-4">
              {result.results.map((r) => (
                <InlineVideoCard key={r.chefId} result={r} />
              ))}
            </div>
          </div>
        )}
      </ResultsArea>
      <InputArea
        onSubmit={handleSubmit}
        isLoading={result.type === "loading"}
        disabled={false}
      >
        <FilterPills activeFilters={activeFilters} onChange={setActiveFilters} />
        <ChefSlotsGrid
          slots={chefSlots}
          selectedIndices={selectedSlotIndices}
          onSlotsChange={(slots) => { setChefSlots(slots); saveChefSlots(slots); }}
          onSelectionChange={setSelectedSlotIndices}
          onResolveChannel={handleResolveChannel}
        />
      </InputArea>
    </div>
  );
}
