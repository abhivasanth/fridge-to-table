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
