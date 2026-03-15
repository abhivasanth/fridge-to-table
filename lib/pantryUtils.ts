/**
 * Pantry normalization and classification utilities.
 *
 * This is the canonical source — the Convex backend (convex/pantry.ts)
 * duplicates this logic and must stay in sync with any changes here.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export type CategoryKey =
  | "oils_fats"
  | "spices_powders"
  | "sauces_condiments"
  | "basics"
  | "other";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  oils_fats: "Oils & fats",
  spices_powders: "Spices & powders",
  sauces_condiments: "Sauces & condiments",
  basics: "Basics",
  other: "Other",
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "oils_fats",
  "spices_powders",
  "sauces_condiments",
  "basics",
  "other",
];

// ---------------------------------------------------------------------------
// normalizeName
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

/**
 * Normalize an ingredient name for deduplication and matching.
 *
 * Steps:
 * 1. Lowercase + trim
 * 2. Strip first matching qualifier prefix
 * 3. Resolve whole-string and partial aliases
 * 4. Strip trailing "s" for simple plurals (with exceptions)
 */
export function normalizeName(raw: string): string {
  if (!raw) return "";

  let name = raw.toLowerCase().trim();
  if (!name) return "";

  // 2. Strip first matching qualifier prefix
  for (const q of QUALIFIER_PREFIXES) {
    if (name.startsWith(q)) {
      name = name.slice(q.length);
      break;
    }
  }

  // 3. Resolve aliases — try whole string first, then word-level replacement
  if (ALIASES[name]) {
    name = ALIASES[name];
  } else {
    for (const [from, to] of Object.entries(ALIASES)) {
      // Only do word-level replacement for single-word aliases
      if (!from.includes(" ")) {
        // Replace as whole word
        const re = new RegExp(`\\b${from}\\b`, "g");
        name = name.replace(re, to);
      } else {
        // Multi-word alias: simple substring replacement
        if (name.includes(from)) {
          name = name.replace(from, to);
        }
      }
    }
  }

  // 4. Strip trailing "s" for simple plurals
  name = depluralise(name);

  return name;
}

function depluralise(name: string): string {
  // Only operate on the last word
  const words = name.split(" ");
  const last = words[words.length - 1];

  if (last.length <= 3) return name; // too short
  if (!last.endsWith("s")) return name;
  if (last.endsWith("ss")) return name; // grass, moss, etc.
  if (NO_DEPLURAL.has(name)) return name; // whole-name exception
  if (NO_DEPLURAL.has(last)) return name; // last-word exception

  let singular: string;
  if (last.endsWith("ies") && last.length > 4) {
    // berries → berry, cherries → cherry
    singular = last.slice(0, -3) + "y";
  } else if (last.endsWith("ves")) {
    // halves → half (but not all -ves words; good enough for ingredients)
    singular = last.slice(0, -3) + "f";
  } else if (last.endsWith("oes") && last.length > 4) {
    // tomatoes → tomato, potatoes → potato, mangoes → mango
    singular = last.slice(0, -2);
  } else {
    singular = last.slice(0, -1);
  }

  words[words.length - 1] = singular;
  return words.join(" ");
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

// Build a reverse lookup: item → category
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

/**
 * Classify a (normalised) ingredient name into a pantry category.
 *
 * Resolution order:
 * 1. Exact match in the known-items map
 * 2. Keyword containment: does the name contain a known item or vice versa?
 * 3. Heuristic regex fallback
 * 4. Default → "other"
 */
export function classifyCategory(name: string): CategoryKey {
  // 1. Direct lookup
  const direct = itemToCategory.get(name);
  if (direct) return direct;

  // 2. Keyword containment — check if any known item is contained in the name
  //    or the name is contained in a known item
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
