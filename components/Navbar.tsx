"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-[#1A3A2A] flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="8.25" y="9.5" width="1.5" height="6.5" rx="0.75" fill="white"/>
        <rect x="5.5" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        <rect x="8.4" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        <rect x="11.3" y="2" width="1.2" height="6" rx="0.6" fill="white"/>
        <path d="M5.5 8 Q9 9.5 12.5 8" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
        <ellipse cx="4.5" cy="4.5" rx="1.8" ry="2.5" transform="rotate(-30 4.5 4.5)" fill="#D4622A"/>
      </svg>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo — acts as home button */}
        <Link href="/" className="flex items-center gap-2.5 text-[#1A3A2A] font-semibold text-base tracking-tight">
          <LogoMark />
          <span>Fridge to Table</span>
        </Link>

        {/* Favorites link with heart */}
        <Link
          href="/favourites"
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            pathname === "/favourites"
              ? "text-[#D4622A]"
              : "text-gray-500 hover:text-[#D4622A]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 13.5L2.05 7.55C1.02 6.52 1.02 4.85 2.05 3.82C3.08 2.79 4.75 2.79 5.78 3.82L8 6.04L10.22 3.82C11.25 2.79 12.92 2.79 13.95 3.82C14.98 4.85 14.98 6.52 13.95 7.55L8 13.5Z"/>
          </svg>
          <span>Favorites</span>
        </Link>
      </div>
    </nav>
  );
}
