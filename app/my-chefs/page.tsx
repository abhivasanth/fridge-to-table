"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { CHEFS } from "@/lib/chefs";
import { getSlotIds, setSlotIds, MAX_CHEF_TABLE_SLOTS } from "@/lib/chefSlots";
import { CustomChefCard } from "@/components/CustomChefCard";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

const MAX_CUSTOM_CHEFS = 6;

type PreviewChef = {
  channelId: string;
  channelName: string;
  channelThumbnail: string;
  resolvedAt: number;
};

type ResolveError = "parse_error" | "not_found" | "api_error" | null;

const RESOLVE_ERROR_MESSAGES: Record<NonNullable<ResolveError>, string> = {
  parse_error: "Paste a YouTube channel URL or @handle",
  not_found: "We couldn't find that channel — check the URL",
  api_error: "Something went wrong — try again",
};

export default function MyChefsMPage() {
  const { user } = useUser();
  const userId = user?.id ?? "";
  const customChefs =
    useQuery(
      api.customChefs.listCustomChefs,
      userId ? { userId } : "skip"
    ) ?? [];

  const addCustomChef = useMutation(api.customChefs.addCustomChef);
  const removeCustomChef = useMutation(api.customChefs.removeCustomChef);
  const resolveYouTubeChannel = useAction(api.customChefs.resolveYouTubeChannel);

  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PreviewChef | null>(null);
  const [resolveError, setResolveError] = useState<ResolveError>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [slotIds, setSlotIdsState] = useState<string[]>([]);
  const [slotWarning, setSlotWarning] = useState(false);

  useEffect(() => {
    setSlotIdsState(getSlotIds());
  }, []);

  const atCustomLimit = customChefs.length >= MAX_CUSTOM_CHEFS;

  function toggleSlot(id: string) {
    setSlotWarning(false);
    if (slotIds.includes(id)) {
      const next = slotIds.filter((s) => s !== id);
      setSlotIdsState(next);
      setSlotIds(next);
    } else {
      if (slotIds.length >= MAX_CHEF_TABLE_SLOTS) {
        setSlotWarning(true);
        return;
      }
      const next = [...slotIds, id];
      setSlotIdsState(next);
      setSlotIds(next);
    }
  }

  async function handleResolve() {
    if (!input.trim()) return;
    setIsResolving(true);
    setResolveError(null);
    setPreview(null);
    setAddError(null);

    const result = await resolveYouTubeChannel({ input: input.trim() });

    if (result.ok) {
      const isDuplicateDefault = CHEFS.some(
        (c) => c.youtubeChannelId === result.channelId
      );
      if (isDuplicateDefault) {
        setAddError("This chef is already in Featured Chefs.");
        setIsResolving(false);
        return;
      }
      setPreview({
        channelId: result.channelId,
        channelName: result.channelName,
        channelThumbnail: result.channelThumbnail,
        resolvedAt: result.resolvedAt,
      });
    } else {
      setResolveError(result.error);
    }

    setIsResolving(false);
  }

  async function handleAdd() {
    if (!preview || !userId) return;
    setAddError(null);

    try {
      await addCustomChef({
        userId,
        channelId: preview.channelId,
        channelName: preview.channelName,
        channelThumbnail: preview.channelThumbnail,
        resolvedAt: preview.resolvedAt,
      });
      if (slotIds.length < MAX_CHEF_TABLE_SLOTS) {
        const next = [...slotIds, preview.channelId];
        setSlotIdsState(next);
        setSlotIds(next);
      }
      setInput("");
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("duplicate") || customChefs.some((c) => c.channelId === preview.channelId)) {
        setAddError("This chef is already in your list.");
      } else if (message.toLowerCase().includes("limit")) {
        setAddError(`You've reached the ${MAX_CUSTOM_CHEFS}-chef limit.`);
      } else {
        setAddError("Something went wrong — try again.");
      }
    }
  }

  async function handleRemove(channelId: string) {
    if (!userId) return;
    await removeCustomChef({ userId, channelId });
    const next = slotIds.filter((id) => id !== channelId);
    setSlotIdsState(next);
    setSlotIds(next);
  }

  const selectedCount = slotIds.length;

  return (
    <SubscriptionGuard>
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            href="/?tab=chefs-table"
            className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
          >
            ← Back to search
          </Link>
          <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">My Chefs</h1>
        </div>
        <p className="text-gray-500 text-sm mb-2">
          Manage your Chef&apos;s Table lineup
        </p>
        <p className="text-xs text-gray-400 mb-6">
          {selectedCount} of {MAX_CHEF_TABLE_SLOTS} selected for Chef&apos;s Table
        </p>

        {slotWarning && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-amber-700 text-sm">
              You can show up to {MAX_CHEF_TABLE_SLOTS} chefs on Chef&apos;s Table. Uncheck one to add another.
            </p>
          </div>
        )}

        {/* Featured Chefs section */}
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Featured Chefs</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {CHEFS.map((chef) => {
              const isSlotted = slotIds.includes(chef.id);
              return (
                <button
                  key={chef.id}
                  type="button"
                  onClick={() => toggleSlot(chef.id)}
                  className={`relative flex flex-col items-center p-4 pt-5 rounded-2xl border-2 text-center transition-all ${
                    isSlotted ? "border-[#D4622A] bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {isSlotted && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#D4622A] flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8.5l3 3 5-5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  <span className="text-3xl mb-2">{chef.emoji}</span>
                  <p className="text-sm font-semibold text-[#1A3A2A] line-clamp-2 w-full">{chef.name}</p>
                  <p className="text-xs text-gray-400">{chef.country}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Your Chefs section */}
        <div className="mb-8">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Your Chefs</span>
            <span className="text-xs text-gray-300">({customChefs.length}/{MAX_CUSTOM_CHEFS})</span>
          </div>

          {customChefs.length === 0 ? (
            <p className="text-gray-400 text-sm mb-4">
              No custom chefs added yet — add one below.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {customChefs.map((chef) => {
                const isSlotted = slotIds.includes(chef.channelId);
                return (
                  <div
                    key={chef.channelId}
                    className={`relative flex flex-col items-center p-4 pt-5 rounded-2xl border-2 text-center transition-all ${
                      isSlotted ? "border-[#D4622A] bg-orange-50" : "border-gray-200 bg-white"
                    }`}
                  >
                    {/* Remove button — always visible */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRemove(chef.channelId); }}
                      className={`absolute top-2 w-5 h-5 rounded-full bg-gray-200 hover:bg-red-100 flex items-center justify-center transition-colors ${
                        isSlotted ? "right-9" : "right-2"
                      }`}
                      aria-label={`Remove ${chef.channelName}`}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l6 6M8 2l-6 6" />
                      </svg>
                    </button>
                    {/* Checkmark badge */}
                    {isSlotted && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#D4622A] flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M4 8.5l3 3 5-5.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSlot(chef.channelId)}
                      className="flex flex-col items-center w-full"
                    >
                      <img
                        src={chef.channelThumbnail}
                        alt={chef.channelName}
                        className="w-12 h-12 rounded-full object-cover mb-2"
                      />
                      <p className="text-sm font-semibold text-[#1A3A2A] line-clamp-2 w-full">{chef.channelName}</p>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add custom chef section */}
          {atCustomLimit ? (
            <p className="text-gray-500 text-sm bg-white rounded-2xl border border-gray-200 p-4">
              You&apos;ve reached the {MAX_CUSTOM_CHEFS}-chef limit. Remove a chef to add another.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setResolveError(null);
                    setPreview(null);
                    setAddError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleResolve();
                  }}
                  placeholder="YouTube channel URL or @handle"
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#D4622A] bg-white"
                />
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={isResolving || !input.trim()}
                  className="bg-[#D4622A] text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 hover:bg-[#bf5724] transition-colors"
                >
                  {isResolving ? "Finding…" : "Find"}
                </button>
              </div>

              {resolveError && (
                <p className="text-red-500 text-sm">
                  {RESOLVE_ERROR_MESSAGES[resolveError]}
                </p>
              )}

              {addError && (
                <p className="text-red-500 text-sm">{addError}</p>
              )}

              {preview && (
                <CustomChefCard
                  chef={preview}
                  onAdd={handleAdd}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </SubscriptionGuard>
  );
}
