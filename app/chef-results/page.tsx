"use client";
// Chef's Table results page — reads video results from localStorage
// (set by home page after searchChefVideos action completes).
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChefVideoCard } from "@/components/ChefVideoCard";
import { VideoModal } from "@/components/VideoModal";
import type { ChefVideoResult } from "@/types/recipe";

type ActiveVideo = {
  title: string;
  thumbnail: string;
  videoId: string;
  chefName: string;
  chefEmoji: string;
};

export default function ChefResultsPage() {
  const [results, setResults] = useState<ChefVideoResult[] | null>(null);
  const [activeVideo, setActiveVideo] = useState<ActiveVideo | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("chefTableResults");
    if (stored) {
      try {
        setResults(JSON.parse(stored));
      } catch {
        setResults([]);
      }
    } else {
      setResults([]);
    }
  }, []);

  if (results === null) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center pb-20">
        <p className="text-2xl animate-bounce">🍳</p>
      </div>
    );
  }

  const foundCount = results.filter((r) => r.found).length;
  const totalVideos = results.reduce((sum, r) => sum + (r.videos?.length ?? 0), 0);

  return (
    <div className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link href="/?tab=chefs-table" className="text-[#D4622A] text-sm mb-6 block hover:underline mt-6 sm:mt-0">
          ← Back
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-1">
          Here&apos;s what the chefs would cook
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          {totalVideos > 0
            ? `${totalVideos} video${totalVideos > 1 ? "s" : ""} found from ${foundCount} chef${foundCount > 1 ? "s" : ""}`
            : "No videos found — try different ingredients"}
        </p>

        {results.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No results to show.</p>
            <Link href="/" className="text-[#D4622A] font-semibold">
              Start a new search
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {results.map((result) => (
              <section key={result.chefId}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{result.chefEmoji}</span>
                  <h2 className="text-lg font-semibold text-[#1A3A2A]">{result.chefName}</h2>
                </div>

                {!result.found || !result.videos?.length ? (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                    <p className="text-gray-400 text-sm">No matching videos for these ingredients.</p>
                    <p className="text-gray-400 text-xs mt-1">Try different ingredients.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {result.videos.map((video) => (
                      <ChefVideoCard
                        key={video.videoId}
                        video={video}
                        chefName={result.chefName}
                        chefEmoji={result.chefEmoji}
                        onPlay={setActiveVideo}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {activeVideo && (
        <VideoModal
          videoId={activeVideo.videoId}
          title={activeVideo.title}
          chefName={activeVideo.chefName}
          chefEmoji={activeVideo.chefEmoji}
          thumbnail={activeVideo.thumbnail}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
