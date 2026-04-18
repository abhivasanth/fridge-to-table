"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Single source of truth: all subscription actions live on /settings.
// When a subscription-gated page rejects a user, we bounce them there.
export function PaywallScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <p className="text-gray-400 animate-pulse">Redirecting...</p>
    </main>
  );
}
