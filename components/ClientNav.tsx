"use client";
import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";

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

  return (
    <>
      {/* Toggle button — when closed: fixed top-left; when open: at right edge of sidebar */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        className="fixed top-3 z-[100] w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:text-gray-700 hover:bg-black/5 transition-all"
        style={{
          left: sidebarOpen && hydrated ? "284px" : "16px",
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

      <Sidebar
        open={sidebarOpen}
        onClose={closeSidebar}
        isDesktop={isDesktop}
      />

      {/* Main content wrapper */}
      <div
        style={{
          marginLeft: showPush ? "320px" : "0",
          transition: "margin-left 0.25s ease",
        }}
      >
        {children}
      </div>
    </>
  );
}
