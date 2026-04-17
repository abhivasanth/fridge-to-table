import Anthropic from "@anthropic-ai/sdk";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel Hobby allows up to 60s; Sonnet needs ~28s

export async function POST(req: Request) {
  try {
    const { sessionId, ingredients, filters } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    const ingredientList = ingredients.join(", ");
    const cuisineNote = filters.cuisine || "any style";

    // Including the schema in the prompt dramatically improves Claude's JSON reliability
    const recipeSchema = `{
  title: string,
  description: string (1-2 sentences),
  cookingTime: number (minutes),
  difficulty: "easy" | "medium" | "hard",
  servings: number,
  cuisineType: string,
  ingredients: Array<{ name: string, amount: string, inFridge: boolean }>,
  steps: string[],
  shoppingList: string[],
  uncertainIngredients?: string[]
}`;

    // System message enables Anthropic prompt caching — cached after first call,
    // reducing input processing time for subsequent calls within 5 minutes.
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: "You are a creative chef generating recipe suggestions.",
      messages: [
        {
          role: "user",
          content: `The user has these ingredients: ${ingredientList}.
Generate exactly 3 recipes using mostly these ingredients.
Cuisine style: ${cuisineNote}.
Maximum cooking time: ${filters.maxCookingTime} minutes.
Difficulty level: ${filters.difficulty}.

For each recipe:
- Set inFridge: true for ingredients the user already has
- List any additional required ingredients in shoppingList
- If you need to slightly exceed the time or difficulty to give good results,
  do so and briefly note it in the description

Return a JSON array of exactly 3 recipes. No other text. Schema for each recipe:
${recipeSchema}`,
        },
      ],
    });

    let fullText = "";
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
      }
    }

    // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
    const text = fullText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    const recipes = JSON.parse(text);

    if (!Array.isArray(recipes) || recipes.length === 0) {
      return Response.json(
        { error: "No recipes could be generated for these ingredients" },
        { status: 500 }
      );
    }

    const recipeSetId = await convex.mutation(
      api.recipes.saveRecipeSet,
      { sessionId, ingredients, filters, results: recipes }
    );

    return Response.json({ recipeSetId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-recipes] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
