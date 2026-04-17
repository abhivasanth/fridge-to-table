"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PaywallScreen } from "@/components/PaywallScreen";
import { useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  requiredPlan?: "basic" | "chef"; // If set, user must have this specific plan
};

export function SubscriptionGuard({ children, requiredPlan }: Props) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();

  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  // Still loading
  if (!clerkLoaded || (user && dbUser === undefined)) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  // Not signed in — middleware should catch this, but just in case
  if (!user) {
    router.push("/sign-in");
    return null;
  }

  // No user record yet — redirect to pricing (fresh sign-up)
  if (!dbUser) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Setting up your account...</p>
      </div>
    );
  }

  // Check subscription status
  const isActive =
    dbUser.subscriptionStatus === "active" ||
    dbUser.subscriptionStatus === "trialing";

  if (!isActive) {
    return <PaywallScreen />;
  }

  // Check plan-specific access (e.g., Chef-only features)
  if (requiredPlan && dbUser.plan !== requiredPlan) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-[#1A3A2A] mb-2">
            Chef plan required
          </h2>
          <p className="text-gray-500 mb-4">
            This feature is available on the Chef plan.
          </p>
          <button
            onClick={() => router.push("/pricing")}
            className="bg-[#D4622A] text-white px-6 py-3 rounded-2xl font-medium hover:bg-[#BF5525] transition-colors"
          >
            Upgrade to Chef
          </button>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
