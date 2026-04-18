"use client";
import Link from "next/link";
import { WordmarkLogo } from "./WordmarkLogo";

export function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: "rgba(250, 247, 242, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(45, 74, 46, 0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center">
        {/* Spacer for the fixed toggle button */}
        <div className="w-9 h-9 flex-shrink-0" />

        {/* Logo wordmark */}
        <Link
          href="/"
          className="flex items-center ml-3"
          style={{ transition: "transform 0.3s ease" }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <WordmarkLogo />
        </Link>
      </div>
    </nav>
  );
}
