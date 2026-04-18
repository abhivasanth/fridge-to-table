import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

describe("users module", () => {
  test("getByClerkId returns null for unknown user", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.users.getByClerkId, { clerkId: "user_none" });
    expect(result).toBeNull();
  });

  test("getOrCreateUser inserts a new user on first call (clerkId derived from auth)", async () => {
    const t = convexTest(schema);
    await withUser(t, "user_test").mutation(api.users.getOrCreateUser, {
      email: "test@example.com",
      firstName: "Test",
      lastName: "User",
    });
    const user = await t.query(api.users.getByClerkId, { clerkId: "user_test" });
    expect(user?.clerkId).toBe("user_test");
    expect(user?.email).toBe("test@example.com");
    expect(user?.firstName).toBe("Test");
    expect(user?.lastName).toBe("User");
  });

  test("getOrCreateUser is idempotent — does not create duplicates", async () => {
    const t = convexTest(schema);
    await withUser(t, "user_test").mutation(api.users.getOrCreateUser, {
      email: "test@example.com",
    });
    await withUser(t, "user_test").mutation(api.users.getOrCreateUser, {
      email: "test@example.com",
    });
    const allUsers = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(allUsers).toHaveLength(1);
  });

  test("getOrCreateUser updates email/name fields when user already exists", async () => {
    const t = convexTest(schema);
    await withUser(t, "user_test").mutation(api.users.getOrCreateUser, {
      email: "old@example.com",
      firstName: "Old",
    });
    await withUser(t, "user_test").mutation(api.users.getOrCreateUser, {
      email: "new@example.com",
      firstName: "New",
      lastName: "Person",
    });
    const user = await t.query(api.users.getByClerkId, { clerkId: "user_test" });
    expect(user?.email).toBe("new@example.com");
    expect(user?.firstName).toBe("New");
    expect(user?.lastName).toBe("Person");
  });

  test("getOrCreateUser throws when caller is not authenticated", async () => {
    const t = convexTest(schema);
    await expect(
      t.mutation(api.users.getOrCreateUser, { email: "anon@example.com" })
    ).rejects.toThrow(/Not authenticated/);
  });

  test("two different Clerk users can't collide — identity is derived per-call", async () => {
    const t = convexTest(schema);
    await withUser(t, "user_alice").mutation(api.users.getOrCreateUser, {
      email: "alice@example.com",
    });
    await withUser(t, "user_bob").mutation(api.users.getOrCreateUser, {
      email: "bob@example.com",
    });
    const alice = await t.query(api.users.getByClerkId, { clerkId: "user_alice" });
    const bob = await t.query(api.users.getByClerkId, { clerkId: "user_bob" });
    expect(alice?.email).toBe("alice@example.com");
    expect(bob?.email).toBe("bob@example.com");
  });
});
