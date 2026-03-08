"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";
import { CustomChefCard } from "@/components/CustomChefCard";

const MAX_CHEFS = 6;

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
  const sessionId = getSessionId();
  const chefs =
    useQuery(
      api.customChefs.listCustomChefs,
      sessionId ? { sessionId } : "skip"
    ) ?? [];

  const addCustomChef = useMutation(api.customChefs.addCustomChef);
  const removeCustomChef = useMutation(api.customChefs.removeCustomChef);
  const resolveYouTubeChannel = useAction(api.customChefs.resolveYouTubeChannel);

  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PreviewChef | null>(null);
  const [resolveError, setResolveError] = useState<ResolveError>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const atLimit = chefs.length >= MAX_CHEFS;

  async function handleResolve() {
    if (!input.trim()) return;
    setIsResolving(true);
    setResolveError(null);
    setPreview(null);
    setAddError(null);

    const result = await resolveYouTubeChannel({ input: input.trim() });

    if (result.ok) {
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
    if (!preview || !sessionId) return;
    setAddError(null);

    try {
      await addCustomChef({
        sessionId,
        channelId: preview.channelId,
        channelName: preview.channelName,
        channelThumbnail: preview.channelThumbnail,
        resolvedAt: preview.resolvedAt,
      });
      setInput("");
      setPreview(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("duplicate") || chefs.some((c) => c.channelId === preview.channelId)) {
        setAddError("This chef is already in your list.");
      } else if (message.toLowerCase().includes("limit")) {
        setAddError(`You've reached the ${MAX_CHEFS}-chef limit.`);
      } else {
        setAddError("Something went wrong — try again.");
      }
    }
  }

  async function handleRemove(channelId: string) {
    if (!sessionId) return;
    await removeCustomChef({ sessionId, channelId });
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/" className="text-[#D4622A] text-sm mb-6 block hover:underline">
          ← Back to search
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">My Chefs</h1>
        <p className="text-gray-500 text-sm mb-6">
          Up to {MAX_CHEFS} YouTube cooking channels
        </p>

        {/* Saved chefs list */}
        {chefs.length === 0 ? (
          <p className="text-gray-400 text-sm mb-6">
            No chefs added yet — add one below.
          </p>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {chefs.map((chef) => (
              <CustomChefCard
                key={chef.channelId}
                chef={chef}
                onRemove={() => handleRemove(chef.channelId)}
              />
            ))}
          </div>
        )}

        {/* Add section */}
        {atLimit ? (
          <p className="text-gray-500 text-sm bg-white rounded-2xl border border-gray-200 p-4">
            You've reached the {MAX_CHEFS}-chef limit. Remove a chef to add another.
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
  );
}
