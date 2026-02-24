"use client";
import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChefGrid } from "@/components/ChefGrid";
import { LoadingChef } from "@/components/LoadingChef";
import { getSelectedChefs } from "@/lib/chefs";
import type { RecipeFilters } from "@/types/recipe";

type ActiveTab = "any-recipe" | "chefs-table";

const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

const SELECTED_CHEFS_KEY = "fridgeToTable_selectedChefs";

// ─── Feature cards data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    emoji: "📸",
    iconBg: "bg-orange-100",
    title: "Snap, speak, or type",
    body: "Snap a pic or type a short summary or say it out loud.",
  },
  {
    emoji: "👨‍🍳",
    iconBg: "bg-green-100",
    title: "Cook like your idols",
    body: "Recipes inspired by Gordon Ramsay, Jamie Oliver, and more. Real techniques. Your ingredients. One beautiful result.",
  },
  {
    emoji: "🎯",
    iconBg: "bg-yellow-100",
    title: "Any skill, any night",
    body: "Filter from quick weeknight dinners to weekend showstoppers. Every recipe is designed to help you grow.",
  },
  {
    emoji: "✨",
    iconBg: "bg-purple-100",
    title: "Zero ads. Always.",
    body: "We're subscriber-funded. No sponsored recipes. No pop-ups. Just you and the food you love.",
  },
];

// ─── Testimonials data ───────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "I used to stare at my fridge for 20 minutes wondering what to cook. Now I just snap a photo and I've got three delicious options in seconds.",
    author: "Priya M., San Francisco",
  },
  {
    quote:
      "The Chef's Table feature is unreal. Getting Jamie Oliver-inspired recipes from what's actually in my kitchen? Game changer.",
    author: "Jake T., London",
  },
  {
    quote:
      "Finally an app that meets me where I am. I can type, talk, or take a picture — and it always gets it right.",
    author: "Aisha K., Toronto",
  },
];

// ─── Verified badge icon ─────────────────────────────────────────────────────

function VerifiedBadge({ active }: { active: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="8"
        cy="8"
        r="7.5"
        fill={active ? "white" : "currentColor"}
        fillOpacity={active ? 1 : 0.85}
      />
      <path
        d="M5 8.5l2 2 4-4"
        stroke={active ? "#C4622A" : "white"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Floating emojis ─────────────────────────────────────────────────────────

const FLOATING_EMOJIS = [
  { emoji: "🥑", top: "22%", left: "8%",  size: 32, delay: 1.0 },
  { emoji: "🍋", top: "35%", right: "9%", size: 26, delay: 1.2 },
  { emoji: "🧄", top: "58%", left: "6%",  size: 24, delay: 1.4 },
  { emoji: "🌿", top: "15%", right: "15%",size: 22, delay: 1.6 },
  { emoji: "🍅", top: "70%", right: "7%", size: 28, delay: 1.8 },
  { emoji: "🧅", top: "48%", left: "12%", size: 20, delay: 2.0 },
];

// ─── Page component ──────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("any-recipe");
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
    if (saved) {
      try {
        setSelectedChefIds(JSON.parse(saved));
      } catch {
        // ignore malformed data
      }
    }
  }, []);

  function handleChefSelectionChange(ids: string[]) {
    setSelectedChefIds(ids);
    localStorage.setItem(SELECTED_CHEFS_KEY, JSON.stringify(ids));
  }

  const analyzePhoto = useAction(api.photos.analyzePhoto);
  const generateRecipes = useAction(api.recipes.generateRecipes);
  const searchChefVideos = useAction(api.chefs.searchChefVideos);

  async function handleSubmit(ingredients: string[], imageBase64?: string) {
    setIsLoading(true);
    setError(null);

    try {
      let finalIngredients = ingredients;

      if (imageBase64) {
        const photoResult = await analyzePhoto({ imageBase64 });
        if (photoResult.ingredients.length === 0) {
          setError("We couldn't detect many ingredients — try typing them instead.");
          setIsLoading(false);
          return;
        }
        finalIngredients = photoResult.ingredients;
      }

      if (activeTab === "chefs-table") {
        const selectedChefs = getSelectedChefs(selectedChefIds);
        const results = await searchChefVideos({
          ingredients: finalIngredients,
          chefs: selectedChefs.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            youtubeChannelId: c.youtubeChannelId,
          })),
        });
        localStorage.setItem("chefTableResults", JSON.stringify(results));
        router.push("/chef-results");
      } else {
        const sessionId = getSessionId();
        const recipeSetId = await generateRecipes({
          sessionId,
          ingredients: finalIngredients,
          filters,
        });
        router.push(`/results/${recipeSetId}`);
      }
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  const chefsTableDisabled = activeTab === "chefs-table" && selectedChefIds.length === 0;

  return (
    <div className="min-h-screen bg-[#FAF6F1] relative overflow-x-hidden">

      {/* ── BACKGROUND BLOBS ─────────────────────────────────── */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* Top-right rust blob */}
        <div style={{
          position: "absolute", top: "-80px", right: "-80px",
          width: "500px", height: "500px",
          background: "radial-gradient(circle, rgba(196,98,42,0.07) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "blobFadeIn 2s ease-out 0.3s both",
        }} />
        {/* Bottom-left green blob */}
        <div style={{
          position: "absolute", bottom: "-100px", left: "-100px",
          width: "600px", height: "600px",
          background: "radial-gradient(circle, rgba(45,74,46,0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "blobFadeIn 2s ease-out 0.6s both",
        }} />
        {/* Center-left peach blob */}
        <div style={{
          position: "absolute", top: "30%", left: "-60px",
          width: "350px", height: "350px",
          background: "radial-gradient(circle, rgba(232,196,168,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          animation: "blobFadeIn 2s ease-out 0.9s both",
        }} />
      </div>

      {/* ── FLOATING EMOJIS ──────────────────────────────────── */}
      <div aria-hidden="true" className="hidden sm:block" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, userSelect: "none" }}>
        {FLOATING_EMOJIS.map((item) => (
          <span
            key={item.emoji}
            style={{
              position: "absolute",
              top: item.top,
              left: "left" in item ? item.left : undefined,
              right: "right" in item ? (item as any).right : undefined,
              fontSize: `${item.size}px`,
              animation: `floatIn 1s ease-out ${item.delay}s both`,
              display: "block",
            }}
          >
            {item.emoji}
          </span>
        ))}
      </div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="pt-16 pb-10 px-4 text-center" style={{ position: "relative", zIndex: 1 }}>
        <h1
          className="font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl font-bold text-[#1A3A2A] leading-tight mb-4 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          What&apos;s in your{" "}
          <em className="text-[#D4622A] not-italic">fridge?</em>
        </h1>
        <p
          className="text-gray-500 text-base max-w-md mx-auto animate-fade-up"
          style={{ animationDelay: "0.35s" }}
        >
          Tell us your ingredients — we&apos;ll find you a fun recipe.
        </p>
      </section>

      {/* ── APP PLAYGROUND ───────────────────────────────────── */}
      <section id="playground" className="px-4 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div
          className="max-w-xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-fade-up-card"
          style={{ animationDelay: "0.5s" }}
        >

          {/* Tab selector */}
          <div className="flex gap-1 bg-gray-50 rounded-2xl p-1 mb-6">
            {(["any-recipe", "chefs-table"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab
                    ? "bg-[#D4622A] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "any-recipe" ? "Any Recipe" : (
                  <>
                    Chef&apos;s Table
                    <VerifiedBadge active={activeTab === "chefs-table"} />
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Chef grid */}
          {activeTab === "chefs-table" && (
            <div className="mb-6">
              <ChefGrid
                selectedIds={selectedChefIds}
                onChange={handleChefSelectionChange}
              />
            </div>
          )}

          <IngredientInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={chefsTableDisabled}
            beforeSubmit={
              activeTab === "any-recipe" ? (
                <FiltersPanel filters={filters} onChange={setFilters} />
              ) : undefined
            }
          />

          {/* Chef animation appears below the button while loading */}
          {isLoading && <LoadingChef />}

          {/* Error message */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex justify-between items-start">
              <p className="text-red-700 text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 ml-3 flex-shrink-0"
                aria-label="Dismiss error"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES SECTION ─────────────────────────────────── */}
      <section className="px-4 py-20 bg-[#FAF6F1]" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold tracking-widest text-[#D4622A] uppercase text-center mb-3">
            Why Fridge to Table
          </p>
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-[#1A3A2A] text-center mb-12">
            Built around{" "}
            <em className="text-[#D4622A] not-italic">how you cook</em>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
              >
                <div className={`w-12 h-12 ${f.iconBg} rounded-xl flex items-center justify-center text-2xl mb-4`}>
                  {f.emoji}
                </div>
                <h3 className="font-semibold text-[#1A3A2A] text-base mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS SECTION ─────────────────────────────── */}
      <section className="px-4 py-20 bg-[#1A3A2A]" style={{ position: "relative", zIndex: 1 }}>
        <div className="max-w-4xl mx-auto">
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-white text-center mb-2">
            Trusted by{" "}
            <em className="text-[#C9A84C] not-italic">thousands of food lovers</em>
          </h2>
          <p className="text-white/60 text-center text-sm mb-12">
            Enjoy cooking. From easy weeknight dinners to weekend showstoppers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.author}
                className="bg-[#224232] rounded-2xl p-6 border border-white/10"
              >
                <div className="text-[#C9A84C] text-sm mb-3">★★★★★</div>
                <p className="text-white/90 text-sm leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-white/50 text-xs">— {t.author}</p>
              </div>
            ))}
          </div>

          {/* Rating stat */}
          <div className="text-center mt-12">
            <p className="font-[family-name:var(--font-playfair)] text-6xl font-bold text-white">4.9</p>
            <p className="text-[#C9A84C] text-sm mt-1">★★★★★</p>
            <p className="text-white/50 text-xs mt-1">Average rating from our community</p>
          </div>
        </div>
      </section>

    </div>
  );
}
