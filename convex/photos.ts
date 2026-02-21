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
    _ctx,
    args
  ): Promise<{ ingredients: string[]; uncertain: string[] }> => {
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

    const response = await client.messages.create({
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
              text: `Analyse this fridge photo for a vegetarian recipe app.
List every food ingredient you can identify.
All ingredients are assumed vegetarian. Only add an ingredient to the "uncertain" list
if it could plausibly be a meat or fish product (e.g. a broth that could be meat-based,
an unlabelled sausage, or an unidentifiable protein). Never flag spices, condiments,
herbs, salt, pepper, oils, vinegars, dairy, eggs, fruit, vegetables, grains, or
any ingredient that is obviously vegetarian.
Return JSON only, no other text: { "ingredients": string[], "uncertain": string[] }`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";

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
