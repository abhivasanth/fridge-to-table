"use client";

import { PantryPage } from "@/components/PantryPage";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

export default function MyPantryRoute() {
  return (
    <SubscriptionGuard>
      <PantryPage />
    </SubscriptionGuard>
  );
}
