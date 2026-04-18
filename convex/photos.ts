import { action } from "./_generated/server";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";

// Analyses a fridge photo using Claude's vision capability.
// The image is NEVER stored — it is sent to Claude and immediately discarded.
// Returns the detected ingredients, with ambiguous ones flagged in `uncertain`.
export const analyzePhoto = action({
  args: {
    // Full base64 data URL, e.g. "data:image/jpeg;base64,/9j/4AAQ..."
    // Compressed to ≤1024px on the client before being sent here.
    imageBase64: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ingredients: string[]; uncertain: string[] }> => {
    // Gate on auth — this action calls the Anthropic vision API, which costs
    // per-image and is a cost/DoS vector if left open to anonymous callers.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // API key is stored securely in Convex environment variables — never in the browser
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // Strip the "data:image/jpeg;base64," prefix — Claude needs only the raw bytes
    const base64Data = args.imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const mediaTypeMatch = args.imageBase64.match(/data:(image\/\w+);/);
    const mediaType = (mediaTypeMatch?.[1] ?? "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/gif"
      | "image/webp";

    let response;
    try {
      console.log("[analyzePhoto] Starting Claude vision call");
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64Data },
              },
              {
                type: "text",
                text: `Analyse this fridge photo and list every food ingredient you can identify.
Flag an ingredient as "uncertain" only if it is completely unidentifiable (e.g. an
unlabelled package with no visible contents). Common items like vegetables, dairy,
eggs, condiments, sauces, grains, and fruit should always go in "ingredients".
Return JSON only, no other text: { "ingredients": string[], "uncertain": string[] }`,
              },
            ],
          },
        ],
      });
      console.log("[analyzePhoto] Claude returned response");
    } catch (err: any) {
      console.error("[analyzePhoto] Claude API error:", err?.message || err);
      throw new Error("Photo analysis failed: " + (err?.message || "unknown error"));
    }

    // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    const parsed = JSON.parse(text) as {
      ingredients?: string[];
      uncertain?: string[];
    };

    return {
      ingredients: parsed.ingredients ?? [],
      uncertain: parsed.uncertain ?? [],
    };
  },
});
