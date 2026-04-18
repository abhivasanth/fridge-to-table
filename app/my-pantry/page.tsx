import { PantryPage } from "@/components/PantryPage";
import { AuthGuard } from "@/components/AuthGuard";

export default function MyPantryRoute() {
  return (
    <AuthGuard>
      <PantryPage />
    </AuthGuard>
  );
}
