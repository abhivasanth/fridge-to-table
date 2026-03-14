// Displays a single YouTube video thumbnail card.
// Chef identity is shown in the section header on the results page.

type VideoInfo = {
  title: string;
  thumbnail: string;
  videoId: string;
};

type Props = {
  video: VideoInfo;
  chefName: string;
  chefEmoji: string;
  onPlay: (video: VideoInfo & { chefName: string; chefEmoji: string }) => void;
};

export function ChefVideoCard({ video, chefName, chefEmoji, onPlay }: Props) {
  return (
    <button
      type="button"
      onClick={() => onPlay({ ...video, chefName, chefEmoji })}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left w-full cursor-pointer"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full aspect-video object-cover"
        />
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
      </div>
      <div className="p-4">
        <p className="text-[#1A3A2A] font-medium text-sm line-clamp-2">{video.title}</p>
        <p className="text-xs text-gray-400 mt-2">▶ Tap to play</p>
      </div>
    </button>
  );
}
