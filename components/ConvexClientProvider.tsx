"use client";

import { ReactNode, useEffect } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Auto-syncs the signed-in Clerk user into our Convex `users` table once
// Clerk is loaded and Convex is authenticated.
//
// `clerkId` is derived server-side from the JWT (see convex/users.ts) — we only
// pass profile fields from the client.
function UserSync() {
  const { user, isLoaded } = useUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isLoaded || !user) return;
    // Fire-and-forget: the Convex `users` row is not yet read by any UI path
    // (identity data is served from Clerk's useUser()). If the mutation fails
    // due to transient Convex/Clerk JWT race conditions, we log and continue —
    // the row is created on the next sign-in instead. Revisit if we add a
    // feature that reads from the `users` table at runtime.
    getOrCreateUser({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    }).catch(console.error);
    // Intentionally excluded from deps:
    // - getOrCreateUser: stable ref from useMutation; including it is harmless
    //   but noisy
    // - user.primaryEmailAddress / firstName / lastName: we intentionally don't
    //   re-sync when these change mid-session (they're rare edits via Clerk's
    //   Manage Account modal; next sign-in picks them up). Trading freshness
    //   for fewer mutation calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, user?.id]);

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
