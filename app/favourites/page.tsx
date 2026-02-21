import { FavouritesGrid } from "@/components/FavouritesGrid";
import Link from "next/link";

export default function FavouritesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-green-600 text-sm hover:underline mb-4 inline-block"
          >
            ← Back to search
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Your Favourites</h1>
          <p className="text-gray-400 text-sm mt-1">
            Recipes you&apos;ve saved this session
          </p>
        </div>
        <FavouritesGrid />
      </div>
    </main>
  );
}
