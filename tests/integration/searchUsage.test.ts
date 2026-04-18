import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("searchUsage — single-tier rate limit", () => {
  test("new user is allowed on first check", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
    expect(result.remaining).toBe(100);
  });

  test("user remains allowed up to the 100-search limit", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      for (let i = 0; i < 99; i++) {
        await ctx.db.insert("searchUsage", {
          userId: "user_test",
          searchedAt: now - i * 1000,
        });
      }
    });

    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(99);
    expect(result.remaining).toBe(1);
  });

  test("user is blocked once 100 searches hit within the window", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) {
        await ctx.db.insert("searchUsage", {
          userId: "user_test",
          searchedAt: now - i * 1000,
        });
      }
    });

    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(100);
    expect(result.remaining).toBe(0);
    expect(result.resetsAt).not.toBeNull();
  });

  test("searches older than the 5-hour window are not counted", async () => {
    const t = convexTest(schema);
    const now = Date.now();
    const windowMs = 5 * 60 * 60 * 1000;

    await t.run(async (ctx) => {
      // 50 expired + 50 in-window = only 50 counted
      for (let i = 0; i < 50; i++) {
        await ctx.db.insert("searchUsage", {
          userId: "user_test",
          searchedAt: now - windowMs - i * 1000,
        });
      }
      for (let i = 0; i < 50; i++) {
        await ctx.db.insert("searchUsage", {
          userId: "user_test",
          searchedAt: now - i * 1000,
        });
      }
    });

    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(50);
    expect(result.remaining).toBe(50);
  });

  test("other users' searches don't count against this user's limit", async () => {
    const t = convexTest(schema);
    const now = Date.now();

    await t.run(async (ctx) => {
      for (let i = 0; i < 100; i++) {
        await ctx.db.insert("searchUsage", {
          userId: "other_user",
          searchedAt: now - i * 1000,
        });
      }
    });

    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
  });

  test("recordSearch persists a usage row scoped to the user", async () => {
    const t = convexTest(schema);
    await t.mutation(api.searchUsage.recordSearch, { userId: "user_test" });
    const result = await t.query(api.searchUsage.checkLimit, {
      userId: "user_test",
    });
    expect(result.used).toBe(1);
    expect(result.remaining).toBe(99);
  });
});
