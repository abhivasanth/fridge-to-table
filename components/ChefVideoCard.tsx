// Displays a single YouTube video result from a chef's channel.
// Shows a "no result" state gracefully if the chef had no matching video.
import type { ChefVideoResult } from "@/types/recipe";

type Props = {
  result: ChefVideoResult;
};

export function ChefVideoCard({ result }: Props) {
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
    <a
      href={`https://www.youtube.com/watch?v=${result.video.videoId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.video.thumbnail}
        alt={result.video.title}
        className="w-full aspect-video object-cover"
      />
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span>{result.chefEmoji}</span>
          <span className="text-sm font-semibold text-[#D4622A]">{result.chefName}</span>
        </div>
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{result.video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Watch on YouTube</p>
      </div>
    </a>
  );
}
