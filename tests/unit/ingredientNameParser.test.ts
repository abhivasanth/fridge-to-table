import { describe, it, expect } from "vitest";
import {
  parseIngredientName,
  parseIngredientNames,
} from "@/lib/ingredientNameParser";

describe("parseIngredientName", () => {
  it("strips quantity and unit from '1 tsp red chili powder'", () => {
    expect(parseIngredientName("1 tsp red chili powder")).toBe(
      "red chili powder"
    );
  });

  it("strips fraction and unit from '1/2 cup rice'", () => {
    expect(parseIngredientName("1/2 cup rice")).toBe("rice");
  });

  it("strips glued metric unit from '200g chicken'", () => {
    expect(parseIngredientName("200g chicken")).toBe("chicken");
  });

  it("strips quantity and size adjective from '2 medium onions'", () => {
    expect(parseIngredientName("2 medium onions")).toBe("onions");
  });

  it("strips number range and count-unit from '10-12 leaves curry leaves'", () => {
    expect(parseIngredientName("10-12 leaves curry leaves")).toBe(
      "curry leaves"
    );
  });

  it("strips 'to taste' prefix from 'to taste salt'", () => {
    expect(parseIngredientName("to taste salt")).toBe("salt");
  });

  it("strips 'a pinch of' prefix from 'a pinch of salt'", () => {
    expect(parseIngredientName("a pinch of salt")).toBe("salt");
  });

  it("strips quantity and full unit name from '3 tablespoons water'", () => {
    expect(parseIngredientName("3 tablespoons water")).toBe("water");
  });

  it("returns bare name unchanged for 'salt'", () => {
    expect(parseIngredientName("salt")).toBe("salt");
  });

  it("returns bare name unchanged for 'oil'", () => {
    expect(parseIngredientName("oil")).toBe("oil");
  });

  it("lowercases the result for '1 Tsp Red Chili Powder'", () => {
    expect(parseIngredientName("1 Tsp Red Chili Powder")).toBe(
      "red chili powder"
    );
  });

  it("trims whitespace from input and output", () => {
    expect(parseIngredientName("  1 cup  flour  ")).toBe("flour");
  });

  it("handles 'a handful of cilantro'", () => {
    expect(parseIngredientName("a handful of cilantro")).toBe("cilantro");
  });

  it("handles '2 cloves garlic'", () => {
    expect(parseIngredientName("2 cloves garlic")).toBe("garlic");
  });

  it("handles '1 bunch spinach'", () => {
    expect(parseIngredientName("1 bunch spinach")).toBe("spinach");
  });

  it("handles '500ml milk'", () => {
    expect(parseIngredientName("500ml milk")).toBe("milk");
  });

  it("handles '2 stalks celery'", () => {
    expect(parseIngredientName("2 stalks celery")).toBe("celery");
  });

  it("returns full lowercased string when all words are consumed", () => {
    expect(parseIngredientName("1 cup")).toBe("1 cup");
  });
});

describe("parseIngredientNames", () => {
  it("splits 'to taste salt and pepper' into ['salt', 'pepper']", () => {
    expect(parseIngredientNames("to taste salt and pepper")).toEqual([
      "salt",
      "pepper",
    ]);
  });

  it("splits 'salt and pepper' into ['salt', 'pepper']", () => {
    expect(parseIngredientNames("salt and pepper")).toEqual([
      "salt",
      "pepper",
    ]);
  });

  it("returns single-element array for '1 tsp red chili powder'", () => {
    expect(parseIngredientNames("1 tsp red chili powder")).toEqual([
      "red chili powder",
    ]);
  });

  it("returns single-element array for 'oil'", () => {
    expect(parseIngredientNames("oil")).toEqual(["oil"]);
  });

  it("returns single-element array for 'to taste salt'", () => {
    expect(parseIngredientNames("to taste salt")).toEqual(["salt"]);
  });
});
