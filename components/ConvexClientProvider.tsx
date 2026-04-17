"use client";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;

    // Clear stale anonymous localStorage data on first auth
    const migratedKey = `ftt_migrated_${user.id}`;
    if (!localStorage.getItem(migratedKey)) {
      localStorage.removeItem("ftt_search_history");
      localStorage.removeItem("fridge_session_id");
      localStorage.removeItem("chefTableResults");
      localStorage.removeItem("fridgeToTable_selectedChefs");
      localStorage.setItem(migratedKey, "1");
    }

    getOrCreateUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    }).catch(console.error);
  }, [isLoaded, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <UserSync />
      {children}
    </ConvexProviderWithClerk>
  );
}
