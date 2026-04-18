"use client";

export function WordmarkLogo({
  width = 126,
  height = 28,
}: {
  width?: number;
  height?: number;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 132 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="fridge to table"
      style={{ fontFamily: "var(--font-outfit, Outfit, sans-serif)" }}
    >
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
