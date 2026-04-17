"use client";

import { PricingCards } from "@/components/PricingCards";

export function PaywallScreen() {
  return (
    <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-2">
          Your subscription has ended
        </h1>
        <p className="text-gray-500 mb-8">
          Choose a plan to continue cooking.
        </p>
        <PricingCards />
      </div>
    </main>
  );
}
