// Displays a single YouTube video result from a chef's channel.
// Shows a "no result" state gracefully if the chef had no matching video.
import type { ChefVideoResult } from "@/types/recipe";
import { VideoFavouriteButton } from "@/components/VideoFavouriteButton";

type Props = {
  result: ChefVideoResult;
  onPlay: (result: ChefVideoResult) => void;
};

export function ChefVideoCard({ result, onPlay }: Props) {
  if (!result.found || !result.video) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <span className="text-3xl mb-2">{result.chefEmoji}</span>
        <p className="font-semibold text-[#1A3A2A] text-sm">{result.chefName}</p>
        <p className="text-gray-400 text-sm mt-2">😕 No video found for these ingredients.</p>
        <p className="text-gray-400 text-xs mt-1">Try different ingredients.</p>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPlay(result)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onPlay(result); }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full cursor-pointer"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.video.thumbnail}
          alt={result.video.title}
          className="w-full aspect-video object-cover"
        />
        {/* Play icon overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
          aria-label="Play video"
        >
          <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
              <path d="M6 4l12 6-12 6V4z" />
            </svg>
          </div>
        </div>
        {/* Favourite heart overlay */}
        <div className="absolute top-2 right-2 z-10">
          <VideoFavouriteButton
            videoId={result.video.videoId}
            title={result.video.title}
            thumbnail={result.video.thumbnail}
            channelId={result.channelId}
            channelName={result.chefName}
            size="sm"
          />
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>{result.chefEmoji}</span>
          <span className="text-sm font-semibold text-[#D4622A]">{result.chefName}</span>
        </div>
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{result.video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Tap to play</p>
      </div>
    </div>
  );
}
