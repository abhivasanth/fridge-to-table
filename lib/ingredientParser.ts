// Converts a comma-separated string of ingredients into a clean array.
// Used to process the text input on the home page.
// Examples:
//   "eggs, milk, butter"  →  ["eggs", "milk", "butter"]
//   "  tomatoes ,,"       →  ["tomatoes"]
export function parseIngredients(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
