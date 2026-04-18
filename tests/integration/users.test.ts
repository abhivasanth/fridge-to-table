import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("users module", () => {
  test("getByClerkId returns null for unknown user", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.users.getByClerkId, { clerkId: "user_none" });
    expect(result).toBeNull();
  });

  test("getOrCreateUser inserts a new user on first call", async () => {
    const t = convexTest(schema);
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
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
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "test@example.com",
    });
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "test@example.com",
    });
    const allUsers = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(allUsers).toHaveLength(1);
  });

  test("getOrCreateUser updates email/name fields when user already exists", async () => {
    const t = convexTest(schema);
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "old@example.com",
      firstName: "Old",
    });
    await t.mutation(api.users.getOrCreateUser, {
      clerkId: "user_test",
      email: "new@example.com",
      firstName: "New",
      lastName: "Person",
    });
    const user = await t.query(api.users.getByClerkId, { clerkId: "user_test" });
    expect(user?.email).toBe("new@example.com");
    expect(user?.firstName).toBe("New");
    expect(user?.lastName).toBe("Person");
  });
});
