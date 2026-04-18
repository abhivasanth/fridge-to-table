import Anthropic from "@anthropic-ai/sdk";
import { fetchMutation } from "convex/nextjs";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    // Route is marked as a public route in middleware.ts so this 401 path can
    // actually fire (middleware.auth.protect() would otherwise return 404).
    const { userId, getToken } = await auth();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Forward the Clerk JWT to Convex so saveRecipeSet can derive userId
    // server-side via requireUserId(ctx) — never trusting client-supplied IDs.
    const token = await getToken({ template: "convex" });
    if (!token) {
      return Response.json(
        { error: "Unable to obtain Convex token" },
        { status: 500 }
      );
    }

    const { ingredients, filters } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const ingredientList = ingredients.join(", ");
    const cuisineNote = filters.cuisine || "any style";

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

    const recipeSetId = await fetchMutation(
      api.recipes.saveRecipeSet,
      { ingredients, filters, results: recipes },
      { token }
    );

    return Response.json({ recipeSetId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-recipes] Error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
