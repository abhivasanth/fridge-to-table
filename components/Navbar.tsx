"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function LogoMark() {
  return (
    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* Fork handle */}
        <rect x="8.25" y="9.5" width="1.5" height="6.5" rx="0.75" fill="white"/>        {/* Three tines */}
        <rect x="5.5" y="2" width="1.2" height="6" rx="0.6" fill="white"/>        <rect x="8.4" y="2" width="1.2" height="6" rx="0.6" fill="white"/>        <rect x="11.3" y="2" width="1.2" height="6" rx="0.6" fill="white"/>        {/* Tine joiner */}
        <path d="M5.5 8 Q9 9.5 12.5 8" stroke="white" strokeWidth="1.2" fill="none" strokeLinecap="round"/>        {/* Leaf accent */}
        <ellipse cx="4.5" cy="4.5" rx="1.8" ry="2.5" transform="rotate(-30 4.5 4.5)" fill="#D4622A"/>      </svg>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-[#1A3A2A] shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 text-white font-semibold text-base tracking-tight">
          <LogoMark />
          <span>Fridge to Table</span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Home
          </Link>
          <Link
            href="/favourites"
            className={`text-sm font-medium transition-colors ${
              pathname === "/favourites" ? "text-white" : "text-white/70 hover:text-white"
            }`}
          >
            Favourites
          </Link>
          <Link
            href="/#playground"
            className="bg-[#D4622A] hover:bg-[#BF5525] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors"
          >
            Try Free →
          </Link>
        </div>
      </div>
    </nav>
  );
}
