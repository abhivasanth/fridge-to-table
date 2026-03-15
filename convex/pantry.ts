import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Duplicated normalization & classification logic from lib/pantryUtils.ts
// (Convex backend runs in an isolated environment and cannot import from lib/)
// ---------------------------------------------------------------------------

type CategoryKey =
  | "oils_fats"
  | "spices_powders"
  | "sauces_condiments"
  | "basics"
  | "other";

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

  words[words.length - 1] = last.slice(0, -1);
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
// classifyCategory
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<CategoryKey, string[]> = {
  oils_fats: [
    "oil",
    "olive oil",
    "sesame oil",
    "ghee",
    "butter",
    "coconut oil",
    "vegetable oil",
    "canola oil",
    "sunflower oil",
    "avocado oil",
    "peanut oil",
    "mustard oil",
    "lard",
    "shortening",
    "margarine",
  ],
  spices_powders: [
    "turmeric",
    "red chili powder",
    "chili powder",
    "coriander powder",
    "cumin",
    "mustard seed",
    "garam masala",
    "paprika",
    "oregano",
    "gochugaru",
    "black pepper",
    "white pepper",
    "cinnamon",
    "cardamom",
    "clove",
    "bay leaf",
    "bay leaves",
    "curry leaves",
    "curry leaf",
    "fenugreek",
    "nutmeg",
    "thyme",
    "rosemary",
    "basil",
    "parsley",
    "dill",
    "sage",
    "tarragon",
    "chili flakes",
    "red pepper flakes",
    "saffron",
    "smoked paprika",
    "cayenne",
    "allspice",
    "fennel",
    "onion powder",
    "garlic powder",
    "turmeric powder",
    "italian seasoning",
    "cumin powder",
    "coriander",
    "cumin seed",
    "sesame seed",
    "pepper",
  ],
  sauces_condiments: [
    "soy sauce",
    "vinegar",
    "fish sauce",
    "hot sauce",
    "tajin",
    "sriracha",
    "ketchup",
    "mayo",
    "mayonnaise",
    "worcestershire",
    "mustard",
    "dijon mustard",
    "honey",
    "maple syrup",
    "oyster sauce",
    "hoisin sauce",
    "teriyaki sauce",
    "mirin",
    "rice vinegar",
    "balsamic vinegar",
    "apple cider vinegar",
    "tahini",
    "miso",
    "gochujang",
    "sambal",
    "chili garlic sauce",
    "pesto",
    "tomato paste",
    "tomato sauce",
  ],
  basics: [
    "salt",
    "sugar",
    "flour",
    "rice",
    "all-purpose flour",
    "bread flour",
    "baking soda",
    "baking powder",
    "cornstarch",
    "brown sugar",
    "powdered sugar",
    "yeast",
    "pasta",
    "spaghetti",
    "noodle",
    "egg",
    "milk",
    "cream",
    "water",
    "broth",
    "stock",
    "chicken broth",
    "vegetable broth",
    "beef broth",
    "coconut milk",
    "sour cream",
    "yogurt",
  ],
  other: [],
};

// Build a reverse lookup: item -> category
const itemToCategory = new Map<string, CategoryKey>();
for (const [cat, items] of Object.entries(CATEGORY_MAP) as [CategoryKey, string[]][]) {
  for (const item of items) {
    itemToCategory.set(item, cat);
  }
}

// Heuristic keywords
const HEURISTIC_KEYWORDS: [RegExp, CategoryKey][] = [
  [/powder|seed|spice/, "spices_powders"],
  [/\boil\b/, "oils_fats"],
  [/sauce|paste|vinegar/, "sauces_condiments"],
];

function classifyCategory(name: string): CategoryKey {
  // 1. Direct lookup
  const direct = itemToCategory.get(name);
  if (direct) return direct;

  // 2. Keyword containment
  for (const [item, cat] of itemToCategory) {
    if (name.includes(item) || item.includes(name)) {
      return cat;
    }
  }

  // 3. Heuristic fallback
  for (const [re, cat] of HEURISTIC_KEYWORDS) {
    if (re.test(name)) return cat;
  }

  // 4. Default
  return "other";
}

// ---------------------------------------------------------------------------
// Convex queries & mutations
// ---------------------------------------------------------------------------

/** Returns all pantry items for a session. */
export const getPantryItems = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pantryItems")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

/**
 * Adds an item to the pantry. Normalizes the name, auto-classifies category,
 * and checks for duplicates using the by_session_and_name index.
 *
 * Returns { alreadyExists: true, existingId } if duplicate,
 * or { alreadyExists: false, id } if newly inserted.
 */
export const addToPantry = mutation({
  args: {
    sessionId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const displayName = args.name.toLowerCase().trim();
    const normalized = normalizeName(args.name);

    // Check for duplicate using the index
    const existing = await ctx.db
      .query("pantryItems")
      .withIndex("by_session_and_name", (q) =>
        q.eq("sessionId", args.sessionId).eq("normalizedName", normalized)
      )
      .first();

    if (existing) {
      return { alreadyExists: true as const, existingId: existing._id };
    }

    const now = Date.now();
    const id = await ctx.db.insert("pantryItems", {
      sessionId: args.sessionId,
      name: displayName,
      normalizedName: normalized,
      category: classifyCategory(normalized),
      createdAt: now,
      updatedAt: now,
    });

    return { alreadyExists: false as const, id };
  },
});

/** Removes a pantry item by its document ID. */
export const removeFromPantry = mutation({
  args: {
    id: v.id("pantryItems"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
