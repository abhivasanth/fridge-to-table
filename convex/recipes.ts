import { action, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import Anthropic from "@anthropic-ai/sdk";
import type { Recipe } from "../types/recipe";

const filtersValidator = v.object({
  cuisine: v.string(),
  maxCookingTime: v.number(),
  difficulty: v.union(
    v.literal("easy"),
    v.literal("medium"),
    v.literal("hard")
  ),
  diet: v.optional(v.union(
    v.literal("vegetarian"),
    v.literal("vegan"),
    v.literal("non-vegetarian")
  )),
});

// Internal mutation — saves a generated recipe set to the database.
// "internal" means it cannot be called directly from the browser; only from actions.
export const insertRecipeSet = internalMutation({
  args: {
    sessionId: v.string(),
    ingredients: v.array(v.string()),
    filters: filtersValidator,
    results: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("recipes", {
      ...args,
      generatedAt: Date.now(),
    });
  },
});

// Generates 3 recipes from a list of ingredients and filters.
// Calls Claude API, stores the results in Convex, and returns the recipe set ID.
export const generateRecipes = action({
  args: {
    sessionId: v.string(),
    ingredients: v.array(v.string()),
    filters: filtersValidator,
  },
  handler: async (ctx, args): Promise<Id<"recipes">> => {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const ingredientList = args.ingredients.join(", ");
    const cuisineNote = args.filters.cuisine || "any style";

    const diet = args.filters.diet ?? "vegetarian";
    const dietInstruction =
      diet === "vegan"
        ? "All recipes must be strictly vegan (no meat, fish, dairy, or eggs)."
        : diet === "vegetarian"
          ? "All recipes must be vegetarian (no meat or fish, but dairy and eggs are fine)."
          : "Recipes can include meat, fish, or any other ingredients — non-vegetarian is welcome.";

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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `You are a creative chef generating recipe suggestions.

The user has these ingredients: ${ingredientList}.
Generate exactly 3 recipes using mostly these ingredients.
Diet preference: ${dietInstruction}
Cuisine style: ${cuisineNote}.
Maximum cooking time: ${args.filters.maxCookingTime} minutes.
Difficulty level: ${args.filters.difficulty}.

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

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "[]";
    // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
    const text = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    const recipes = JSON.parse(text) as Recipe[];

    // Use ctx.runMutation to call the internal mutation from within this action
    const recipeSetId = await ctx.runMutation(internal.recipes.insertRecipeSet, {
      sessionId: args.sessionId,
      ingredients: args.ingredients,
      filters: args.filters,
      results: recipes,
    });

    return recipeSetId;
  },
});

// Retrieves a recipe set by its Convex ID.
// Used by the results page and recipe detail page.
export const getRecipeSet = query({
  args: {
    recipeSetId: v.id("recipes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipeSetId);
  },
});
