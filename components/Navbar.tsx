"use client";
import Link from "next/link";

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
