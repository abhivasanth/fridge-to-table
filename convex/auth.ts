// convex/auth.ts — server-side identity helpers.
// Every user-owned query/mutation must derive userId from the authenticated
// JWT, never from a client-supplied argument. This prevents a signed-in user
// from passing another user's ID and reading/writing their data.
import type { QueryCtx, MutationCtx } from "./_generated/server";

/**
 * Returns the Clerk user ID from the authenticated JWT.
 * Throws if the caller is not authenticated.
 */
export async function requireUserId(
  ctx: QueryCtx | MutationCtx
): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }
  return identity.subject;
}
