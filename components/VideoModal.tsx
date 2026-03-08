"use client";

import { useEffect, useRef } from "react";

type Props = {
  videoId: string;
  title: string;
  chefName: string;
  chefEmoji: string;
  thumbnail: string;
  onClose: () => void;
};

export function VideoModal({ videoId, title, chefName, chefEmoji, thumbnail, onClose }: Props) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    modalRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);

    // Mobile scroll lock
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = "0";
      document.body.style.right = "0";

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        window.scrollTo(0, scrollY);
        previousFocusRef.current?.focus();
      };
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Playing: ${title}`}
      ref={modalRef}
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        data-testid="video-modal-backdrop"
        onClick={onClose}
      />

      {/* Modal content */}
      <div className="relative z-10 w-[95vw] md:w-full md:max-w-[800px] mx-auto">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close video"
          className="absolute -top-10 right-0 md:-top-10 md:right-0 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors z-20"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>

        {/* Video player */}
        <div className="relative w-full aspect-video bg-black rounded-t-xl overflow-hidden">
          {/* Thumbnail placeholder while iframe loads */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnail}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="absolute inset-0 w-full h-full z-10"
          />
        </div>

        {/* Info bar */}
        <div className="bg-white rounded-b-xl px-4 py-3">
          <p className="text-[#1A3A2A] font-semibold text-sm line-clamp-2">{title}</p>
          <div className="flex items-center justify-between mt-1">
            <div className="flex items-center gap-1.5">
              <span>{chefEmoji}</span>
              <span className="text-sm text-[#D4622A] font-medium">{chefName}</span>
            </div>
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Watch on YouTube ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
