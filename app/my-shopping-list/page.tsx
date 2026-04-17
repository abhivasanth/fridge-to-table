"use client";

import { ShoppingListPage } from "@/components/ShoppingListPage";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";

export default function MyShoppingListRoute() {
  return (
    <SubscriptionGuard>
      <ShoppingListPage />
    </SubscriptionGuard>
  );
}
