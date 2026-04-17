"use client";

import { FavouritesGrid } from "@/components/FavouritesGrid";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import Link from "next/link";

export default function FavouritesPage() {
  return (
    <SubscriptionGuard>
      <main className="min-h-screen bg-[#FAF6F1] pb-24">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <Link
              href="/"
              className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
            >
              ← Back to search
            </Link>
            <h1 className="text-2xl font-bold text-[#1A3A2A]">Your Favorites</h1>
            <p className="text-gray-400 text-sm mt-1">
              Recipes you&apos;ve saved this session
            </p>
          </div>
          <FavouritesGrid />
        </div>
      </main>
    </SubscriptionGuard>
  );
}
