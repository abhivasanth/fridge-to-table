"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { clearSearchState } from "@/lib/searchState";

const SIDEBAR_STATE_KEY = "ftt_sidebar_open";
const DESKTOP_BREAKPOINT = 768;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    function check() { setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isDesktop;
}

export function ClientNav({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_STATE_KEY);
    if (saved === "true" && window.innerWidth >= DESKTOP_BREAKPOINT) {
      setSidebarOpen(true);
    }
    setHydrated(true);
  }, []);

  function toggleSidebar() {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    if (window.innerWidth >= DESKTOP_BREAKPOINT) {
      localStorage.setItem(SIDEBAR_STATE_KEY, String(next));
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
    if (isDesktop) {
      localStorage.setItem(SIDEBAR_STATE_KEY, "false");
    }
  }

  const showPush = hydrated && isDesktop && sidebarOpen;
  const toggleRef = useRef<HTMLButtonElement>(null);

  const handleDragOffset = useCallback((offset: number) => {
    if (toggleRef.current) {
      if (offset > 0) {
        toggleRef.current.style.transition = "none";
        toggleRef.current.style.left = `${284 - offset}px`;
      } else {
        toggleRef.current.style.transition = "left 0.25s ease";
        toggleRef.current.style.left = sidebarOpen ? "284px" : "16px";
      }
    }
  }, [sidebarOpen]);

  return (
    <>
      {/* Toggle button — when closed: fixed top-left; when open: at right edge of sidebar */}
      <button
        ref={toggleRef}
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        className="fixed top-3 z-[100] w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-all"
        style={{
          left: sidebarOpen && hydrated ? "284px" : hydrated && isDesktop ? "6px" : "16px",
          transition: "left 0.25s ease",
        }}
      >
        {sidebarOpen ? (
          /* Sidebar close icon — panel with arrow left */
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="16" height="14" rx="2" />
            <path d="M7 3v14" />
            <path d="M14 8l-2.5 2.5L14 13" />
          </svg>
        ) : (
          /* Sidebar open icon — panel with arrow right */
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="16" height="14" rx="2" />
            <path d="M7 3v14" />
            <path d="M12 8l2.5 2.5L12 13" />
          </svg>
        )}
      </button>

      {/* Collapsed icon rail — desktop only, when sidebar is closed */}
      {hydrated && isDesktop && !sidebarOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            bottom: 0,
            width: "48px",
            background: "#FAF6F1",
            borderRight: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: "56px",
            gap: "4px",
            zIndex: 90,
          }}
        >
          <button
            type="button"
            onClick={() => {
              clearSearchState();
              router.push("/");
            }}
            title="New Search"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="10" y1="4" x2="10" y2="16" />
              <line x1="4" y1="10" x2="16" y2="10" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.push("/my-chefs")}
            title="My Chefs"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14v-1a2 2 0 012-2h4a2 2 0 012 2v1" />
              <circle cx="8" cy="7" r="2" />
              <path d="M5 7C5 4.5 6 3 8 2c2 1 3 2.5 3 5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={toggleSidebar}
            title="Recent Searches"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.push("/favourites")}
            title="Favorites"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 13.5L2.05 7.55C1.02 6.52 1.02 4.85 2.05 3.82C3.08 2.79 4.75 2.79 5.78 3.82L8 6.04L10.22 3.82C11.25 2.79 12.92 2.79 13.95 3.82C14.98 4.85 14.98 6.52 13.95 7.55L8 13.5Z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.push("/my-pantry")}
            title="My Pantry"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="M2 6h12" />
              <path d="M2 10h12" />
              <path d="M6 6v4" />
              <path d="M10 6v4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => router.push("/my-shopping-list")}
            title="My Shopping List"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 1h2l1.5 8h8L14 3.5H4" />
              <circle cx="5.5" cy="12.5" r="1" />
              <circle cx="11.5" cy="12.5" r="1" />
            </svg>
          </button>
        </div>
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        isDesktop={isDesktop}
        onDragOffset={handleDragOffset}
      />

      {/* Main content wrapper */}
      <div
        style={{
          marginLeft: showPush ? "320px" : hydrated && isDesktop ? "48px" : "0",
          transition: "margin-left 0.25s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
