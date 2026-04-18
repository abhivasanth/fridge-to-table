import { convexTest } from "convex-test";
import { describe, test, expect, vi, afterEach } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("listCustomChefs", () => {
  test("returns empty array when no document exists for session", async () => {
    const t = convexTest(schema);
    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-new",
    });
    expect(result).toEqual([]);
  });

  test("returns chefs sorted by addedAt", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        userId: "session-abc",
        chefs: [
          { channelId: "UC2", channelName: "Chef B", channelThumbnail: "b.jpg", addedAt: 2000, resolvedAt: 1000 },
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 3000,
      });
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-abc",
    });

    expect(result).toHaveLength(2);
    expect(result[0].channelId).toBe("UC1");
    expect(result[1].channelId).toBe("UC2");
  });

  test("only returns chefs for the given userId", async () => {
    const t = convexTest(schema);
    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        userId: "session-X",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 1000,
      });
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-Y",
    });
    expect(result).toEqual([]);
  });
});
describe("addCustomChef", () => {
  const newChef = {
    userId: "session-abc",
    channelId: "UCtest123",
    channelName: "Test Chef",
    channelThumbnail: "https://example.com/thumb.jpg",
    resolvedAt: 1000,
  };

  test("creates a new document when none exists", async () => {
    const t = convexTest(schema);

    await t.mutation(api.customChefs.addCustomChef, newChef);

    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-abc",
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
      userId: "session-abc",
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
        userId: "session-abc",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
          { channelId: "UC2", channelName: "Chef B", channelThumbnail: "b.jpg", addedAt: 2000, resolvedAt: 1000 },
        ],
        updatedAt: 2000,
      });
    });

    await t.mutation(api.customChefs.removeCustomChef, {
      userId: "session-abc",
      channelId: "UC1",
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-abc",
    });
    expect(result).toHaveLength(1);
    expect(result[0].channelId).toBe("UC2");
  });

  test("is a no-op when session has no document", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.customChefs.removeCustomChef, {
        userId: "session-none",
        channelId: "UC1",
      })
    ).resolves.toBeNull();
  });

  test("is a no-op when channelId is not in the list", async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      await ctx.db.insert("customChefs", {
        userId: "session-abc",
        chefs: [
          { channelId: "UC1", channelName: "Chef A", channelThumbnail: "a.jpg", addedAt: 1000, resolvedAt: 1000 },
        ],
        updatedAt: 1000,
      });
    });

    await t.mutation(api.customChefs.removeCustomChef, {
      userId: "session-abc",
      channelId: "UC-not-exist",
    });

    const result = await t.query(api.customChefs.listCustomChefs, {
      userId: "session-abc",
    });
    expect(result).toHaveLength(1);
  });
});

describe("resolveYouTubeChannel", () => {
  function mockFetchSuccess(channelId: string, title: string, thumbnailUrl: string) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({
        items: [{
          id: channelId,
          snippet: {
            title,
            thumbnails: { default: { url: thumbnailUrl } },
          },
        }],
      }),
    }));
  }

  function mockFetchEmpty() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ items: [] }),
    }));
  }

  function mockFetchApiError() {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ error: { message: "API error" } }),
    }));
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.YOUTUBE_API_KEY;
  });

  test("resolves a valid @handle and returns channel metadata", async () => {
    process.env.YOUTUBE_API_KEY = "fake-key";
    mockFetchSuccess("UCtest123", "Babish Culinary Universe", "https://example.com/thumb.jpg");

    const t = convexTest(schema);
    const result = await t.action(api.customChefs.resolveYouTubeChannel, {
      input: "@babish",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.channelId).toBe("UCtest123");
      expect(result.channelName).toBe("Babish Culinary Universe");
      expect(result.channelThumbnail).toBe("https://example.com/thumb.jpg");
    }
  });

  test("returns parse_error for an unrecognised input", async () => {
    process.env.YOUTUBE_API_KEY = "fake-key";
    const t = convexTest(schema);
    const result = await t.action(api.customChefs.resolveYouTubeChannel, {
      input: "not a url",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("parse_error");
  });

  test("returns not_found when YouTube returns no items", async () => {
    process.env.YOUTUBE_API_KEY = "fake-key";
    mockFetchEmpty();
    const t = convexTest(schema);
    const result = await t.action(api.customChefs.resolveYouTubeChannel, {
      input: "@nobody",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_found");
  });

  test("returns not_found when YouTube returns an error object", async () => {
    process.env.YOUTUBE_API_KEY = "fake-key";
    mockFetchApiError();
    const t = convexTest(schema);
    const result = await t.action(api.customChefs.resolveYouTubeChannel, {
      input: "@babish",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_found");
  });

  test("returns api_error when YOUTUBE_API_KEY is not set", async () => {
    const t = convexTest(schema);
    const result = await t.action(api.customChefs.resolveYouTubeChannel, {
      input: "@babish",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("api_error");
  });
});
