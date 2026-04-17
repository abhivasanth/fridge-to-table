import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Normalization logic (duplicated from lib/pantryUtils.ts — must stay in sync)
// Convex backend runs in an isolated environment and cannot import from lib/.
// ---------------------------------------------------------------------------

const QUALIFIER_PREFIXES = [
  "fresh ",
  "dried ",
  "ground ",
  "whole ",
  "raw ",
  "organic ",
  "frozen ",
  "chopped ",
  "minced ",
  "crushed ",
  "roasted ",
  "toasted ",
];

const ALIASES: Record<string, string> = {
  chilli: "chili",
  capsicum: "bell pepper",
  "coriander leaves": "cilantro",
  "spring onion": "green onion",
  scallion: "green onion",
  aubergine: "eggplant",
  courgette: "zucchini",
};

/** Words (or last words) that end in 's' but should NOT be depluralized. */
const NO_DEPLURAL = new Set([
  "leaves",
  "rice",
  "gas",
  "hummus",
  "couscous",
  "asparagus",
  "molasses",
  "lemongrass",
  "citrus",
  "hibiscus",
  "cactus",
  "fungus",
  "octopus",
]);

function depluralise(name: string): string {
  const words = name.split(" ");
  const last = words[words.length - 1];

  if (last.length <= 3) return name;
  if (!last.endsWith("s")) return name;
  if (last.endsWith("ss")) return name;
  if (NO_DEPLURAL.has(name)) return name;
  if (NO_DEPLURAL.has(last)) return name;

  let singular: string;
  if (last.endsWith("ies") && last.length > 4) {
    singular = last.slice(0, -3) + "y";
  } else if (last.endsWith("ves")) {
    singular = last.slice(0, -3) + "f";
  } else if (last.endsWith("oes") && last.length > 4) {
    singular = last.slice(0, -2);
  } else {
    singular = last.slice(0, -1);
  }

  words[words.length - 1] = singular;
  return words.join(" ");
}

function normalizeName(raw: string): string {
  if (!raw) return "";

  let name = raw.toLowerCase().trim();
  if (!name) return "";

  // Strip first matching qualifier prefix
  for (const q of QUALIFIER_PREFIXES) {
    if (name.startsWith(q)) {
      name = name.slice(q.length);
      break;
    }
  }

  // Resolve aliases — try whole string first, then word-level replacement
  if (ALIASES[name]) {
    name = ALIASES[name];
  } else {
    for (const [from, to] of Object.entries(ALIASES)) {
      if (!from.includes(" ")) {
        const re = new RegExp(`\\b${from}\\b`, "g");
        name = name.replace(re, to);
      } else {
        if (name.includes(from)) {
          name = name.replace(from, to);
        }
      }
    }
  }

  // Strip trailing "s" for simple plurals
  name = depluralise(name);

  return name;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Returns all shopping list items for a session. */
export const getShoppingListItems = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Add an item to the shopping list.
 * Returns { alreadyExists: true, existingId } if a duplicate is found,
 * or { alreadyExists: false, id } if the item was inserted.
 */
export const addToShoppingList = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const displayName = args.name.toLowerCase().trim();
    const normalized = normalizeName(args.name);

    // Check for duplicate using the index
    const existing = await ctx.db
      .query("shoppingListItems")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", args.userId).eq("normalizedName", normalized)
      )
      .first();

    if (existing) {
      return { alreadyExists: true as const, existingId: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("shoppingListItems", {
      userId: args.userId,
      name: displayName,
      normalizedName: normalized,
      source: args.source ?? "manual",
      createdAt: now,
      updatedAt: now,
    });

    return { alreadyExists: false as const, id };
  },
});

/** Remove an item from the shopping list by ID. */
export const removeFromShoppingList = mutation({
  args: {
    id: v.id("shoppingListItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
