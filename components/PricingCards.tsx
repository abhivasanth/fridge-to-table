"use client";

import { useUser } from "@clerk/nextjs";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function PricingCards() {
  const { user } = useUser();
  const chefCount = useQuery(api.users.getChefSubscriberCount) ?? 0;
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<"basic" | "chef" | null>(null);

  const isEarlyBird = chefCount < 100;
  const chefPrice = isEarlyBird ? "$3" : "$7";

  async function handleCheckout(plan: "basic" | "chef") {
    if (!user) return;
    setLoadingPlan(plan);

    try {
      const priceId =
        plan === "basic"
          ? process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID!
          : isEarlyBird
            ? process.env.NEXT_PUBLIC_STRIPE_CHEF_EARLY_PRICE_ID!
            : process.env.NEXT_PUBLIC_STRIPE_CHEF_STANDARD_PRICE_ID!;

      const result = await createCheckout({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        priceId,
        plan,
      });

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {/* Top feature pills */}
      <div className="flex flex-wrap justify-center gap-3 mb-8">
        {["Pantry + shopping list", "Save favourite recipes", "Chef's Table videos"].map((label) => (
          <span key={label} className="flex items-center gap-2 bg-white rounded-full px-4 py-2 text-sm text-gray-600 border border-gray-200">
            <span className="w-2 h-2 rounded-full bg-[#C8DFC8]" />
            {label}
          </span>
        ))}
      </div>

      {/* Heading */}
      <h2 className="text-center text-xs font-semibold tracking-[0.2em] text-gray-500 mb-8">
        CHOOSE YOUR PLAN TO GET STARTED
      </h2>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Basic card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-1">Basic</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">
            $2<span className="text-base font-normal text-gray-500">/mo</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Great for casual home cooks.
          </p>

          <ul className="space-y-3 mb-6">
            {["All features included", "Recipe search + photo scan", "Chef's Table videos", "Pantry + shopping list", "Save favourites"].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">&#10003;</span>
                {feature}
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mb-4">Standard usage limits apply</p>

          <button
            onClick={() => handleCheckout("basic")}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loadingPlan === "basic" ? "Loading..." : "Get started"}
            {loadingPlan !== "basic" && <span className="text-xs">&#8599;</span>}
          </button>
        </div>

        {/* Chef card */}
        <div className="bg-white rounded-2xl border-2 border-[#1A3A2A] p-8 relative">
          {isEarlyBird && (
            <span className="absolute -top-3 left-6 bg-[#C8DFC8] text-[#1A3A2A] text-xs font-semibold px-3 py-1 rounded-full">
              First 100 users
            </span>
          )}

          <h3 className="text-xl font-bold text-gray-900 mb-1">Chef</h3>
          <p className="text-3xl font-bold text-gray-900 mb-4">
            {chefPrice}<span className="text-base font-normal text-gray-500">/mo</span>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            For everyday cooking, unlimited inspiration.
          </p>

          <ul className="space-y-3 mb-6">
            {["All features included", "Priority access with higher limits", "Recipe search + photo scan", "Chef's Table videos", "Pantry + shopping list"].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">&#10003;</span>
                {feature}
              </li>
            ))}
          </ul>

          <p className="text-xs text-gray-400 mb-4">
            {isEarlyBird ? "Priority access \u00b7 Standard pricing $7/mo after" : "Priority access"}
          </p>

          <button
            onClick={() => handleCheckout("chef")}
            disabled={loadingPlan !== null}
            className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {loadingPlan === "chef" ? "Loading..." : "Get Chef plan"}
            {loadingPlan !== "chef" && <span className="text-xs">&#8599;</span>}
          </button>
        </div>
      </div>

      {/* Footer note */}
      {isEarlyBird && (
        <p className="text-center text-sm text-gray-500 mt-6">
          Chef plan is <strong>$3/mo for the first 100 members</strong>, then $7/mo. Lock in your rate today.
        </p>
      )}
    </div>
  );
}
