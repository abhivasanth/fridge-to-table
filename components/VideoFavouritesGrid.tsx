"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getSessionId } from "@/lib/session";

// Renders the user's saved video favourites.
// Hidden entirely if empty (no separate empty state — recipe section handles it).
export function VideoFavouritesGrid() {
  const sessionId = getSessionId();
  const videoFavourites = useQuery(
    api.videoFavourites.getVideoFavourites,
    sessionId ? { sessionId } : "skip"
  );
  const removeVideoFavourite = useMutation(api.videoFavourites.removeVideoFavourite);

  if (!videoFavourites || videoFavourites.length === 0) return null;

  return (
    <div className="mt-12">
      <h2 className="text-lg font-semibold text-[#1A3A2A] mb-4">Saved Videos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {videoFavourites.map((fav) => (
          <div
            key={fav._id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative"
          >
            {/* Remove button */}
            <button
              onClick={() => removeVideoFavourite({ sessionId, videoId: fav.videoId })}
              aria-label="Remove from favourites"
              className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-red-500 transition-colors"
            >
              <span className="text-sm">♥</span>
            </button>

            {/* Thumbnail linking to YouTube */}
            <a
              href={`https://www.youtube.com/watch?v=${fav.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fav.thumbnail}
                alt={fav.title}
                className="w-full aspect-video object-cover"
              />
              <div className="p-4">
                <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{fav.title}</p>
                <p className="text-xs text-[#D4622A] font-medium mt-2">{fav.channelName}</p>
                <p className="text-xs text-gray-400 mt-1">Watch on YouTube ↗</p>
              </div>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
