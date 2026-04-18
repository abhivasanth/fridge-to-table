import { ShoppingListPage } from "@/components/ShoppingListPage";
import { AuthGuard } from "@/components/AuthGuard";

export default function MyShoppingListRoute() {
  return (
    <AuthGuard>
      <ShoppingListPage />
    </AuthGuard>
  );
}
