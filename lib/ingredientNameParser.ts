/**
 * Strips quantity, unit, and size-adjective prefixes from a recipe
 * shopping-list string, returning just the ingredient name in lowercase.
 *
 * Examples:
 *   "1 tsp red chili powder" → "red chili powder"
 *   "200g chicken"           → "chicken"
 *   "to taste salt"          → "salt"
 *   "a pinch of salt"        → "salt"
 *   "salt"                   → "salt"
 */

const UNITS = new Set([
  // volume
  "tsp",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "ml",
  "l",
  // weight
  "oz",
  "g",
  "kg",
  "lb",
  "lbs",
  // descriptive counts
  "pinch",
  "bunch",
  "handful",
  "slice",
  "slices",
  "piece",
  "pieces",
  "clove",
  "cloves",
  "sprig",
  "sprigs",
  "can",
  "cans",
  "leaf",
  "leaves",
  "stalk",
  "stalks",
]);

const SIZE_ADJECTIVES = new Set(["small", "medium", "large"]);

// Units that can appear glued to a number (e.g. "200g", "500ml")
const GLUED_UNITS = ["g", "kg", "ml", "oz", "lb", "lbs", "l"];

// Matches leading numbers, fractions, decimals, and ranges like "10-12"
const NUMBER_RE = /^[\d]+([./][\d]+)?(-[\d]+([./][\d]+)?)?$/;

export function parseIngredientName(raw: string): string {
  const lowered = raw.trim().toLowerCase();
  if (!lowered) return "";

  // Handle "to taste X"
  const toTasteMatch = lowered.match(/^to\s+taste\s+(.+)$/);
  if (toTasteMatch) return toTasteMatch[1].trim();

  // Handle "a pinch of X", "a handful of X", etc.
  const aUnitOfMatch = lowered.match(
    /^a\s+(pinch|handful|bunch|sprig|slice|piece)\s+of\s+(.+)$/
  );
  if (aUnitOfMatch) return aUnitOfMatch[2].trim();

  const words = lowered.split(/\s+/);

  // Try stripping leading tokens (numbers, units, size adjectives)
  let i = 0;

  // Skip leading numbers/fractions/ranges, including glued units like "200g"
  while (i < words.length) {
    const word = words[i];

    // Pure number or fraction or range
    if (NUMBER_RE.test(word)) {
      i++;
      continue;
    }

    // Glued unit: e.g. "200g", "500ml"
    const gluedMatch = GLUED_UNITS.some(
      (u) => word.length > u.length && word.endsWith(u) && /^\d/.test(word)
    );
    if (gluedMatch) {
      i++;
      continue;
    }

    break;
  }

  // Skip units and size adjectives
  while (i < words.length) {
    const word = words[i];
    if (UNITS.has(word) || SIZE_ADJECTIVES.has(word)) {
      i++;
      continue;
    }
    // Handle "of" after a unit (e.g. "a pinch of" — though main case is
    // handled above, this catches "2 cups of flour")
    if (word === "of" && i > 0) {
      i++;
      continue;
    }
    break;
  }

  // If all words were consumed, return the full lowercased string as fallback
  if (i >= words.length) return lowered;

  return words.slice(i).join(" ");
}

/**
 * Like parseIngredientName but splits compound ingredients joined by " and "
 * into separate names.
 *
 * Examples:
 *   "to taste salt and pepper" → ["salt", "pepper"]
 *   "salt and pepper"          → ["salt", "pepper"]
 *   "1 tsp red chili powder"   → ["red chili powder"]
 *   "oil"                      → ["oil"]
 */
export function parseIngredientNames(raw: string): string[] {
  const parsed = parseIngredientName(raw);
  if (!parsed) return [];

  const parts = parsed.split(" and ");
  return parts.map((p) => p.trim()).filter(Boolean);
}
