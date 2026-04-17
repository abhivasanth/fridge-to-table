"use client";
import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { saveHistoryEntry } from "@/lib/searchHistory";
import { saveSearchState, loadSearchState } from "@/lib/searchState";
import { IngredientInput } from "@/components/IngredientInput";
import { FiltersPanel } from "@/components/FiltersPanel";
import { ChefGrid } from "@/components/ChefGrid";
import { LoadingChef } from "@/components/LoadingChef";
import { CHEFS, defaultToSlot, customToSlot, getSelectedSlots } from "@/lib/chefs";
import type { ChefSlot } from "@/lib/chefs";
import { getSlotIds, validateSelectedChefs } from "@/lib/chefSlots";
import type { RecipeFilters } from "@/types/recipe";

type ActiveTab = "any-recipe" | "chefs-table";

const DEFAULT_FILTERS: RecipeFilters = {
  cuisine: "",
  maxCookingTime: 30,
  difficulty: "easy",
};

const SELECTED_CHEFS_KEY = "fridgeToTable_selectedChefs";
const HAS_VISITED_KEY = "fridgeToTable_hasVisitedHome";

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
      "We used to spend so much on takeout every week. Since using this app, we've been cooking at home way more, eating healthier, and saving money we didn't realize we were wasting.",
    author: "Priya M., San Francisco",
  },
  {
    quote:
      "I used to dread the 'what's for dinner' question. Now my daughter rushes to the fridge to help pick ingredients. We cook together almost every night.",
    author: "Emma R., Sydney",
  },
  {
    quote:
      "I love that I can search for an ingredient and instantly find videos from my favorite chefs. Chef's Table has completely changed how I discover new recipes.",
    author: "Aisha K., Toronto",
  },
  {
    quote:
      "Had leftover rice, some vegetables, and chicken that needed using up. It suggested chicken fried rice and it turned out really well. Will definitely be making it again.",
    author: "Jason M., Austin",
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

// ─── Page component ──────────────────────────────────────────────────────────

export function HomePage({ initialTab }: { initialTab: ActiveTab }) {
  const router = useRouter();

  // Animations: initialize as false (matches server), enable after mount if first visit
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const visited = sessionStorage.getItem(HAS_VISITED_KEY);
    if (!visited) {
      sessionStorage.setItem(HAS_VISITED_KEY, "1");
      setShouldAnimate(true);
    }
  }, []);

  // Saved search state: defer to useEffect for hydration safety
  const [initialText, setInitialText] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [filters, setFilters] = useState<RecipeFilters>(DEFAULT_FILTERS);
  const [selectedChefIds, setSelectedChefIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Restore saved state from sessionStorage after mount
  useEffect(() => {
    const savedState = loadSearchState();
    if (savedState) {
      setFilters(savedState.filters);
      setInitialText(savedState.ingredientText);
    }
    setMounted(true);
  }, []);

  const { user } = useUser();
  const userId = user?.id ?? "";
  const dbUser = useQuery(api.users.getByClerkId, user ? { clerkId: user.id } : "skip");
  const isChefPlan = dbUser?.plan === "chef";
  const isSignedIn = !!user;
  const customChefsResult = useQuery(
    api.customChefs.listCustomChefs,
    userId ? { userId } : "skip"
  );
  const customChefsRaw = customChefsResult ?? [];
  const customChefsLoaded = customChefsResult !== undefined;

  // Build merged chef list: defaults (always) + customs
  const allSlots: ChefSlot[] = [
    ...CHEFS.map(defaultToSlot),
    ...customChefsRaw.map(customToSlot),
  ];

  // Which chefs appear on Chef's Table (max 8, from My Chefs page)
  const [chefTableSlotIds, setChefTableSlotIds] = useState<string[]>([]);

  useEffect(() => {
    setChefTableSlotIds(getSlotIds());
  }, []);

  const visibleChefs = allSlots.filter((s) => chefTableSlotIds.includes(s.id));

  useEffect(() => {
    const saved = localStorage.getItem(SELECTED_CHEFS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const slots = getSlotIds();
        setSelectedChefIds(validateSelectedChefs(parsed, slots));
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

      // Save search state for back-navigation
      saveSearchState({
        activeTab,
        ingredientText: finalIngredients.join(", "),
        filters,
      });

      if (activeTab === "chefs-table") {
        const selectedSlots = getSelectedSlots(selectedChefIds, visibleChefs);
        const results = await searchChefVideos({
          ingredients: finalIngredients,
          chefs: selectedSlots.map((c) => ({
            id: c.id,
            name: c.name,
            emoji: c.emoji,
            youtubeChannelId: c.youtubeChannelId,
          })),
        });
        localStorage.setItem("chefTableResults", JSON.stringify(results));
        router.push("/chef-results");
        saveHistoryEntry({
          id: crypto.randomUUID(),
          query: finalIngredients.join(", "),
          timestamp: Date.now(),
          resultType: "chefs",
          videoResults: results,
        });
      } else {
        const res = await fetch("/api/generate-recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients: finalIngredients, filters }),
        });
        if (!res.ok) throw new Error("Recipe generation failed");
        const { recipeSetId } = await res.json();
        router.push(`/results/${recipeSetId}`);
        saveHistoryEntry({
          id: crypto.randomUUID(),
          query: finalIngredients.join(", "),
          timestamp: Date.now(),
          resultType: "recipes",
          recipeSetId,
        });
      }
    } catch {
      setError("Our chef is taking a break — please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  const chefsTableDisabled =
    activeTab === "chefs-table" && selectedChefIds.length === 0;

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
          ...(shouldAnimate ? { animation: "blobFadeIn 2s ease-out 0.3s both" } : {}),
        }} />
        {/* Bottom-left green blob */}
        <div style={{
          position: "absolute", bottom: "-100px", left: "-100px",
          width: "600px", height: "600px",
          background: "radial-gradient(circle, rgba(45,74,46,0.05) 0%, transparent 70%)",
          filter: "blur(80px)",
          ...(shouldAnimate ? { animation: "blobFadeIn 2s ease-out 0.6s both" } : {}),
        }} />
        {/* Center-left peach blob */}
        <div style={{
          position: "absolute", top: "30%", left: "-60px",
          width: "350px", height: "350px",
          background: "radial-gradient(circle, rgba(232,196,168,0.12) 0%, transparent 70%)",
          filter: "blur(80px)",
          ...(shouldAnimate ? { animation: "blobFadeIn 2s ease-out 0.9s both" } : {}),
        }} />
      </div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="pt-16 pb-10 px-4 text-center" style={{ position: "relative", zIndex: 1 }}>
        <h1
          className={`font-[family-name:var(--font-playfair)] text-5xl sm:text-6xl font-bold text-[#1A3A2A] leading-tight mb-4${shouldAnimate ? " animate-fade-up" : ""}`}
          style={shouldAnimate ? { animationDelay: "0.2s" } : undefined}
        >
          What&apos;s in your{" "}
          <em className="text-[#D4622A]">fridge?</em>
        </h1>
        <p
          className={`text-gray-500 text-base max-w-md mx-auto${shouldAnimate ? " animate-fade-up" : ""}`}
          style={shouldAnimate ? { animationDelay: "0.35s" } : undefined}
        >
          Tell us your ingredients — we&apos;ll find you a fun recipe.
        </p>
      </section>

      {/* ── APP PLAYGROUND ───────────────────────────────────── */}
      <section id="playground" className="px-4 pb-16" style={{ position: "relative", zIndex: 1 }}>
        <div
          className={`max-w-xl mx-auto bg-white rounded-3xl shadow-sm border border-gray-100 p-6${shouldAnimate ? " animate-fade-up-card" : ""}`}
          style={shouldAnimate ? { animationDelay: "0.5s" } : undefined}
        >

          {/* Tab selector */}
          <div className="flex gap-1 bg-gray-50 rounded-2xl p-1 mb-6">
            {(["any-recipe", "chefs-table"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  router.replace(tab === "chefs-table" ? "/?tab=chefs-table" : "/", { scroll: false });
                  const current = loadSearchState();
                  if (current) {
                    saveSearchState({ ...current, activeTab: tab });
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === tab
                    ? "bg-[#D4622A] text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "any-recipe" && "Any Recipe"}
                {tab === "chefs-table" && (
                  <>
                    Chef&apos;s Table
                    <VerifiedBadge active={activeTab === "chefs-table"} />
                  </>
                )}
              </button>
            ))}
          </div>

          {/* Chef grid — skeleton while loading, real grid once ready */}
          {activeTab === "chefs-table" && (
            <div className="mb-6">
              {mounted && customChefsLoaded ? (
                <ChefGrid
                  chefs={visibleChefs}
                  selectedIds={selectedChefIds}
                  onChange={handleChefSelectionChange}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: mounted ? chefTableSlotIds.length || 4 : 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-2xl border-2 border-gray-100 bg-white"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="h-3.5 w-3/4 bg-gray-200 rounded animate-pulse" />
                          <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <IngredientInput
            onSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={chefsTableDisabled}
            initialText={initialText}
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
            Designed around{" "}
            <em className="text-[#D4622A] not-italic">what you already have</em>
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
          <h2 className="font-[family-name:var(--font-playfair)] text-4xl font-bold text-white text-center mb-12">
            Trusted by{" "}
            <em className="text-[#C9A84C] not-italic">thousands of home chefs and food lovers</em>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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

        </div>
      </section>

    </div>
  );
}
