import { internalMutation } from "./_generated/server";

// ---------------------------------------------------------------------------
// One-shot data wipe for the sessionId → userId auth migration.
//
// Context: production Convex (helpful-loris-385) has rows from the pre-auth
// era keyed by `sessionId`. The new schema requires `userId` (Clerk user ID),
// so `npx convex deploy` rejected the auth-feature deploy with a schema
// validation failure. There are zero real users on prod at this point, so
// the correct fix is to wipe all user-owned tables once and let them refill
// from authenticated users going forward.
//
// Usage (ONE TIME ONLY):
//   1. Ensure this file is deployed to prod Convex (with schemaValidation: false
//      in schema.ts so the deploy itself succeeds).
//   2. Go to https://dashboard.convex.dev/d/helpful-loris-385/functions
//   3. Find `migrations:wipeLegacyData` → Run Function → no args.
//   4. After it completes, a follow-up PR restores schemaValidation: true and
//      deletes this file.
//
// This is an `internalMutation` so it cannot be called from the browser —
// only from the Convex dashboard or server-side actions. Deleting the file
// after use removes the attack surface.
// ---------------------------------------------------------------------------
export const wipeLegacyData = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tables = [
      "recipes",
      "favourites",
      "customChefs",
      "pantryItems",
      "shoppingListItems",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const rows = await ctx.db.query(table).collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
      counts[table] = rows.length;
    }

    return counts;
  },
});
