import { describe, it, expect } from "vitest";
import { parseIngredients } from "@/lib/ingredientParser";

describe("parseIngredients", () => {
  it("splits comma-separated ingredients into a trimmed array", () => {
    expect(parseIngredients("eggs, milk, butter")).toEqual([
      "eggs",
      "milk",
      "butter",
    ]);
  });

  it("trims extra whitespace from each item", () => {
    expect(parseIngredients("  eggs ,  milk  ,butter")).toEqual([
      "eggs",
      "milk",
      "butter",
    ]);
  });

  it("filters out empty strings caused by double commas or trailing commas", () => {
    expect(parseIngredients("eggs,,milk,")).toEqual(["eggs", "milk"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseIngredients("")).toEqual([]);
  });

  it("handles a single ingredient with no commas", () => {
    expect(parseIngredients("tomatoes")).toEqual(["tomatoes"]);
  });
});
