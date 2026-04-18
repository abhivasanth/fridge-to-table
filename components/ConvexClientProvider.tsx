"use client";

import { ReactNode, useEffect } from "react";
import { ClerkProvider, useAuth, useUser } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Auto-syncs the signed-in Clerk user into our Convex `users` table once
// BOTH Clerk is loaded AND the JWT has been attached to the Convex client.
// The second condition is critical — without it, the mutation fires before
// `ConvexProviderWithClerk` has forwarded the token and Convex's
// `requireUserId` throws "Not authenticated".
//
// `clerkId` is derived server-side from the JWT (see convex/users.ts) — we only
// pass profile fields from the client.
function UserSync() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!clerkLoaded || !user || !isAuthenticated) return;
    // Fire-and-forget: the Convex `users` row is not yet read by any UI path
    // (identity data is served from Clerk's useUser()). If the mutation fails,
    // we log and continue — the row is re-attempted on the next sign-in.
    getOrCreateUser({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    }).catch(console.error);
    // Intentionally excluded from deps:
    // - getOrCreateUser: stable ref from useMutation
    // - user.primaryEmailAddress / firstName / lastName: we don't re-sync on
    //   mid-session profile edits (rare; next sign-in picks them up).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clerkLoaded, user?.id, isAuthenticated]);

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
