import { convexTest } from "convex-test";
import { describe, test, expect } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

describe("searchChefVideos", () => {
  test("unauthenticated callers can't invoke searchChefVideos", async () => {
    const t = convexTest(schema);
    await expect(
      t.action(api.chefs.searchChefVideos, {
        ingredients: ["chicken"],
        chefs: [
          {
            id: "gordon",
            name: "Gordon",
            emoji: "🧑‍🍳",
            youtubeChannelId: "UC-fake",
          },
        ],
      })
    ).rejects.toThrow(/Not authenticated/);
  });
});
