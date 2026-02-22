"use client";
// Persistent bottom navigation bar — shown on all pages.
// Two tabs: Home (ingredient input) and Saved (favourites).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/", label: "Home", emoji: "🏠" },
    { href: "/favourites", label: "Saved", emoji: "❤️" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex max-w-2xl mx-auto">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors ${
                isActive
                  ? "text-[#D4622A]"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl mb-0.5">{tab.emoji}</span>
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
