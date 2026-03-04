"use client";

type Props = {
  onHamburgerClick: () => void;
};

function WordmarkLogo() {
  return (
    <svg
      width="126" height="28" viewBox="0 0 132 28" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-label="fridge to table"
    >
      <text x="9" y="21" fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18" fontWeight="500" fill="#C5451A" letterSpacing="-0.3">fridge</text>
      <text x="62" y="21" fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18" fontWeight="300" fill="#C5451A" fillOpacity="0.4" letterSpacing="-0.3">to</text>
      <text x="84" y="21" fontFamily="var(--font-outfit, Outfit, sans-serif)"
        fontSize="18" fontWeight="500" fill="#C5451A" letterSpacing="-0.3">table</text>
      <line x1="9" y1="13" x2="126" y2="13" stroke="#C5451A" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

export function AppHeader({ onHamburgerClick }: Props) {
  return (
    <header
      className="flex-shrink-0 flex items-center gap-3 px-4 py-3 z-50"
      style={{
        background: "rgba(250, 247, 242, 0.92)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(45, 74, 46, 0.06)",
      }}
    >
      <button
        type="button"
        onClick={onHamburgerClick}
        aria-label="Open menu"
        style={{
          width: "36px", height: "36px",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "5px", background: "transparent", border: "none", cursor: "pointer",
          flexShrink: 0, padding: 0,
        }}
      >
        <span style={{ display: "block", width: "18px", height: "1.5px", background: "#2D3B2D", borderRadius: "2px" }} />
        <span style={{ display: "block", width: "18px", height: "1.5px", background: "#2D3B2D", borderRadius: "2px" }} />
        <span style={{ display: "block", width: "18px", height: "1.5px", background: "#2D3B2D", borderRadius: "2px" }} />
      </button>
      <WordmarkLogo />
    </header>
  );
}
