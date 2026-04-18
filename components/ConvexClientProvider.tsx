"use client";

import { ReactNode, useEffect } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Auto-syncs the signed-in Clerk user into our Convex `users` table once
// Clerk is loaded and Convex is authenticated.
function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;
    getOrCreateUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    }).catch(console.error);
  }, [isLoaded, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <UserSync />
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
