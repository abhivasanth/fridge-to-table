"use client";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";

type Props = {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  size: "sm" | "md";
};

// Heart button that toggles a video's saved state.
// size="sm": icon-only overlay circle for ChefVideoCard thumbnails.
// size="md": icon + text inline button for VideoModal info bar.
export function VideoFavouriteButton({
  videoId,
  title,
  thumbnail,
  channelId,
  channelName,
  size,
}: Props) {
  const sessionId = getSessionId();
  const videoFavourites = useQuery(
    api.videoFavourites.getVideoFavourites,
    sessionId ? { sessionId } : "skip"
  );
  const saveVideoFavourite = useMutation(api.videoFavourites.saveVideoFavourite);
  const removeVideoFavourite = useMutation(api.videoFavourites.removeVideoFavourite);

  const isFavourited = videoFavourites?.some((f) => f.videoId === videoId);

  async function handleToggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (isFavourited) {
      await removeVideoFavourite({ sessionId, videoId });
    } else {
      await saveVideoFavourite({
        sessionId,
        videoId,
        title,
        thumbnail,
        channelId,
        channelName,
      });
    }
  }

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isFavourited ? "Remove video from favourites" : "Save video to favourites"}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors
          ${isFavourited
            ? "bg-red-500 text-white"
            : "bg-black/40 text-white hover:bg-black/60"
          }`}
      >
        <span className="text-sm">{isFavourited ? "♥" : "♡"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isFavourited ? "Remove video from favourites" : "Save video to favourites"}
      className={`flex items-center gap-1 text-xs transition-colors
        ${isFavourited
          ? "text-red-500 hover:text-red-600"
          : "text-gray-400 hover:text-gray-600"
        }`}
    >
      <span className="text-sm">{isFavourited ? "♥" : "♡"}</span>
      {isFavourited ? "Saved" : "Save"}
    </button>
  );
}
