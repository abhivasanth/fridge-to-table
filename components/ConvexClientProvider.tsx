"use client";

import { ReactNode, useEffect } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthedUser } from "@/hooks/useAuthedUser";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Auto-syncs the signed-in Clerk user into our Convex `users` table once
// auth is fully ready (`useAuthedUser().isReady` includes both Clerk loaded
// AND JWT attached to the Convex client).
//
// `clerkId` is derived server-side from the JWT (see convex/users.ts) — we only
// pass profile fields from the client.
function UserSync() {
  const { user, isReady } = useAuthedUser();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    if (!isReady || !user) return;
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
  }, [isReady, user?.id]);

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
