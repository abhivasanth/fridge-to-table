"use client";
import { useState } from "react";
import type { ChefVideoResult } from "@/types/recipe";

type Props = { result: ChefVideoResult };
type PlayerSize = "normal" | "bigger";

export function InlineVideoCard({ result }: Props) {
  const [playing, setPlaying] = useState(false);
  const [playerSize, setPlayerSize] = useState<PlayerSize>("normal");

  if (!result.found || !result.video) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
        <span className="text-3xl mb-2">{result.chefEmoji}</span>
        <p className="font-semibold text-[#1A3A2A] text-sm">{result.chefName}</p>
        <p className="text-gray-400 text-sm mt-2"><span aria-hidden="true">😕 </span>No video found for these ingredients.</p>
      </div>
    );
  }

  if (playing) {
    const aspectRatio = playerSize === "bigger" ? "75%" : "56.25%";
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div style={{ position: "relative", paddingBottom: aspectRatio, height: 0 }}>
          <iframe
            src={`https://www.youtube.com/embed/${result.video.videoId}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
            title={result.video.title}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50">
          <span className="text-sm text-[#1A3A2A] font-medium">
            {result.chefEmoji} {result.chefName}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlayerSize(playerSize === "normal" ? "bigger" : "normal")}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {playerSize === "normal" ? "↗ Bigger" : "↙ Smaller"}
            </button>
            <button
              type="button"
              onClick={() => { setPlaying(false); setPlayerSize("normal"); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              ✕ Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Thumbnail view
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-shadow block w-full text-left"
    >
      <div style={{ position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={result.video.thumbnail}
          alt={result.video.title}
          className="w-full aspect-video object-cover"
        />
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.15)",
        }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "50%",
            background: "rgba(255,255,255,0.9)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: "18px", marginLeft: "2px" }}>▶</span>
          </div>
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
    </button>
  );
}
