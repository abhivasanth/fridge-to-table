import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("listCustomChefs", () => {
  test("returns empty array when no document exists for session", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-new",
    });
    expect(result).toEqual([]);
  });

  test("returns chefs sorted by addedAt", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        sessionId: "session-abc",
        chefs: [
          { channelId: "UC2", channelName: "Chef B", channelThumbnail: "b.jpg", addedAt: 2000, resolvedAt: 1000 },
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 3000,
      });
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-abc",
    });

    expect(result).toHaveLength(2);
    expect(result[0].channelId).toBe("UC1");
    expect(result[1].channelId).toBe("UC2");
  });

  test("only returns chefs for the given sessionId", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        sessionId: "session-X",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 1000,
      });
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-Y",
    });
    expect(result).toEqual([]);
  });
});
describe("addCustomChef", () => {
  const newChef = {
    sessionId: "session-abc",
    channelId: "UCtest123",
    channelName: "Test Chef",
    channelThumbnail: "https://example.com/thumb.jpg",
    resolvedAt: 1000,
  };

  test("creates a new document when none exists", async () => {
    const t = convexTest(schema);

    await t.mutation(api.customChefs.addCustomChef, newChef);

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-abc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe("UCtest123");
    expect(result[0].channelName).toBe("Test Chef");
  });

  test("appends to existing document", async () => {
    const t = convexTest(schema);

    await t.mutation(api.customChefs.addCustomChef, newChef);
    await t.mutation(api.customChefs.addCustomChef, {
      ...newChef,
      channelId: "UCother456",
      channelName: "Other Chef",
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-abc",
    });
    expect(result).toHaveLength(2);
  });

  test("throws when limit of 6 is reached", async () => {
    const t = convexTest(schema);

    for (let i = 1; i <= 6; i++) {
      await t.mutation(api.customChefs.addCustomChef, {
        ...newChef,
        channelId: `UC${i}`,
        channelName: `Chef ${i}`,
      });
    }

    await expect(
      t.mutation(api.customChefs.addCustomChef, {
        ...newChef,
        channelId: "UC7",
        channelName: "Chef 7",
      })
    ).rejects.toThrow("limit_reached");
  });

  test("throws when channelId is already in the list", async () => {
    const t = convexTest(schema);

    await t.mutation(api.customChefs.addCustomChef, newChef);

    await expect(
      t.mutation(api.customChefs.addCustomChef, newChef)
    ).rejects.toThrow("duplicate");
  });
});

describe("removeCustomChef", () => {
  test("removes the chef with the given channelId", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        sessionId: "session-abc",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
          { channelId: "UC2", channelName: "Chef B", channelThumbnail: "b.jpg", addedAt: 2000, resolvedAt: 1000 },
        ],
        updatedAt: 2000,
      });
    });

    await t.mutation(api.customChefs.removeCustomChef, {
      sessionId: "session-abc",
      channelId: "UC1",
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-abc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe("UC2");
  });

  test("is a no-op when session has no document", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.customChefs.removeCustomChef, {
        sessionId: "session-none",
        channelId: "UC1",
      })
    ).resolves.toBeNull();
  });

  test("is a no-op when channelId is not in the list", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        sessionId: "session-abc",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 1000,
      });
    });

    await t.mutation(api.customChefs.removeCustomChef, {
      sessionId: "session-abc",
      channelId: "UC-not-exist",
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      sessionId: "session-abc",
    });
    expect(result).toHaveLength(1);
  });
});
