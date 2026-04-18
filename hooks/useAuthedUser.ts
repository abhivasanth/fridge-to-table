"use client";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";

/**
 * Combined Clerk + Convex auth readiness check.
 *
 * `isReady` is true only when:
 * - Clerk has finished loading (`isLoaded`)
 * - A Clerk user exists
 * - Convex has received the JWT from `ConvexProviderWithClerk`
 *
 * Use with Convex queries that require auth to avoid the "Not authenticated"
 * race: client code sees a user before the JWT has been forwarded to Convex,
 * fires the query too early, and the server throws.
 *
 * Usage:
 *   const { user, isReady } = useAuthedUser();
 *   const data = useQuery(api.foo.bar, isReady ? {} : "skip");
 *
 * For mutations, gate the handler on `user` (the mutation will fail
 * meaningfully if auth hasn't attached yet; don't block the whole UI).
 */
export function useAuthedUser() {
  const { user, isLoaded } = useUser();
  const { isAuthenticated } = useConvexAuth();
  return {
    user,
    isReady: isLoaded && !!user && isAuthenticated,
  };
}
