"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PaywallScreen } from "@/components/PaywallScreen";
import { useRouter } from "next/navigation";

export function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();

  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  if (!clerkLoaded || (user && dbUser === undefined)) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </div>
    );
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  if (!dbUser) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Setting up your account...</p>
      </div>
    );
  }

  const isActive =
    dbUser.subscriptionStatus === "active" ||
    dbUser.subscriptionStatus === "trialing";

  if (!isActive) {
    return <PaywallScreen />;
  }

  return <>{children}</>;
}
