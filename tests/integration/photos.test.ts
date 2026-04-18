import { convexTest } from "convex-test";
import { describe, test, expect, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";

function withUser(t: ReturnType<typeof convexTest>, clerkId: string) {
  return t.withIdentity({ subject: clerkId });
}

// Mock Anthropic SDK — we never make real API calls in tests
// Must use function (not arrow) because it's called with `new`
vi.mock("@anthropic-ai/sdk", () => {
  const MockAnthropic = vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ingredients: ["eggs", "spinach", "milk"],
                uncertain: [],
              }),
            },
          ],
        }),
      },
    };
  });
  return { default: MockAnthropic };
});

describe("analyzePhoto", () => {
  test("extracts ingredients and uncertain list from an image", async () => {
    const t = convexTest(schema);

    const result = await withUser(t, "user_alice").action(
      api.photos.analyzePhoto,
      { imageBase64: "data:image/jpeg;base64,fakebytes" }
    );

    expect(result.ingredients).toEqual(["eggs", "spinach", "milk"]);
    expect(result.uncertain).toEqual([]);
  });

  test("returns uncertain ingredients flagged by Claude", async () => {
    const t = convexTest(schema);

    // Override mock for this specific test
    const Anthropic = (await import("@anthropic-ai/sdk")).default as any;
    Anthropic.mockImplementationOnce(function () {
      return {
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ingredients: ["eggs", "vegetable broth"],
                  uncertain: ["vegetable broth"],
                }),
              },
            ],
          }),
        },
      };
    });

    const result = await withUser(t, "user_alice").action(
      api.photos.analyzePhoto,
      { imageBase64: "data:image/jpeg;base64,fakebytes" }
    );

    expect(result.uncertain).toContain("vegetable broth");
    expect(result.ingredients).toContain("vegetable broth");
  });

  test("unauthenticated callers can't invoke analyzePhoto", async () => {
    const t = convexTest(schema);
    await expect(
      t.action(api.photos.analyzePhoto, {
        imageBase64: "data:image/jpeg;base64,fakebytes",
      })
    ).rejects.toThrow(/Not authenticated/);
  });
});
