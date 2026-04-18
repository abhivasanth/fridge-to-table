"use client";

import { useUser } from "@clerk/nextjs";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

export function PricingCards() {
  const { user } = useUser();
  const createCheckout = useAction(api.stripe.createCheckoutSession);
  const [loading, setLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  async function handleSubscribe() {
    if (!user) return;
    setCheckoutError(null);
    setLoading(true);

    try {
      const priceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_ID!;
      const result = await createCheckout({
        clerkId: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? "",
        priceId,
      });

      if (result.ok) {
        window.location.href = result.url;
        return;
      }

      if (
        result.reason === "pending_cancel" ||
        result.reason === "already_subscribed" ||
        result.reason === "past_due"
      ) {
        window.location.href = result.redirectTo ?? "/settings";
        return;
      }

      setCheckoutError("We couldn't start checkout. Please try again.");
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutError("We couldn't start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border-2 border-[#1A3A2A] p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Subscription</h3>
        <p className="text-3xl font-bold text-gray-900 mb-4">
          $2.99<span className="text-base font-normal text-gray-500">/mo</span>
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Everything you need to cook with what&apos;s on hand.
        </p>

        <ul className="space-y-3 mb-6">
          {[
            "Recipe search with your ingredients",
            "Chef's Table video results",
            "Photo scan",
            "Pantry + shopping list",
            "Save favourite recipes",
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <span className="w-5 h-5 rounded-full bg-[#C8DFC8] flex items-center justify-center text-xs text-[#1A3A2A]">
                &#10003;
              </span>
              {feature}
            </li>
          ))}
        </ul>

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-[#1A3A2A] text-white text-sm font-medium hover:bg-[#2a5a3a] transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {loading ? "Loading..." : "Subscribe"}
          {!loading && <span className="text-xs">&#8599;</span>}
        </button>

        {checkoutError && (
          <p className="text-center text-sm text-red-500 mt-4">{checkoutError}</p>
        )}
      </div>
    </div>
  );
}
