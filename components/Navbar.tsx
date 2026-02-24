"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function WordmarkLogo() {
  return (
    <svg
      width="126"
      height="28"
      viewBox="0 0 132 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="fridge to table"
      style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
    >
      {/* "fridge" — weight 500 */}
      <text
        x="9"
        y="21"
        fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18"
        fontWeight="500"
        fill="#C5451A"
        letterSpacing="-0.3"
      >
        fridge
      </text>
      {/* "to" — weight 300, opacity 0.4 */}
      <text
        x="62"
        y="21"
        fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18"
        fontWeight="300"
        fill="#C5451A"
        fillOpacity="0.4"
        letterSpacing="-0.3"
      >
        to
      </text>
      {/* "table" — weight 500 */}
      <text
        x="84"
        y="21"
        fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18"
        fontWeight="500"
        fill="#C5451A"
        letterSpacing="-0.3"
      >
        table
      </text>
      {/* Horizontal line — sits just above top of short lowercase letters (x-height) */}
      <line
        x1="9"
        y1="13"
        x2="126"
        y2="13"
        stroke="#C5451A"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky top-0 z-50 animate-slide-down"
      style={{
        background: "rgba(250, 247, 242, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(45, 74, 46, 0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo wordmark */}
        <Link
          href="/"
          className="flex items-center"
          style={{
            transition: "transform 0.3s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <WordmarkLogo />
        </Link>

        {/* Favorites link */}
        <Link
          href="/favourites"
          className="flex items-center gap-1.5 text-sm font-medium"
          style={{
            color: pathname === "/favourites" ? "#2D4A2E" : "#6b7280",
            padding: "8px 16px",
            borderRadius: "100px",
            transition: "all 0.25s ease",
            background: pathname === "/favourites" ? "rgba(45, 74, 46, 0.05)" : "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#2D4A2E";
            e.currentTarget.style.background = "rgba(45, 74, 46, 0.05)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = pathname === "/favourites" ? "#2D4A2E" : "#6b7280";
            e.currentTarget.style.background = pathname === "/favourites" ? "rgba(45, 74, 46, 0.05)" : "transparent";
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M8 13.5L2.05 7.55C1.02 6.52 1.02 4.85 2.05 3.82C3.08 2.79 4.75 2.79 5.78 3.82L8 6.04L10.22 3.82C11.25 2.79 12.92 2.79 13.95 3.82C14.98 4.85 14.98 6.52 13.95 7.55L8 13.5Z" strokeLinejoin="round"/>
          </svg>
          <span>Favorites</span>
        </Link>
      </div>
    </nav>
  );
}
