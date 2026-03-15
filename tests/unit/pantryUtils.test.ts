import { describe, it, expect } from "vitest";
import {
  normalizeName,
  classifyCategory,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/lib/pantryUtils";

describe("normalizeName", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizeName("  Red Chili Powder  ")).toBe("red chili powder");
  });

  it("strips trailing 's' for simple plurals", () => {
    expect(normalizeName("onions")).toBe("onion");
  });

  it("deplurals -oes → -o (tomatoes, potatoes)", () => {
    expect(normalizeName("tomatoes")).toBe("tomato");
    expect(normalizeName("potatoes")).toBe("potato");
    expect(normalizeName("mangoes")).toBe("mango");
  });

  it("deplurals -ies → -y (berries, cherries)", () => {
    expect(normalizeName("berries")).toBe("berry");
    expect(normalizeName("cherries")).toBe("cherry");
    expect(normalizeName("anchovies")).toBe("anchovy");
  });

  it("deplurals -ves → -f (halves)", () => {
    expect(normalizeName("halves")).toBe("half");
  });

  it("does not strip 's' from words like rice", () => {
    expect(normalizeName("rice")).toBe("rice");
  });

  it("does not strip 's' from words like gas", () => {
    expect(normalizeName("gas")).toBe("gas");
  });

  it("resolves aliases: chilli → chili", () => {
    expect(normalizeName("chilli powder")).toBe("chili powder");
  });

  it("strips qualifier prefix 'fresh'", () => {
    expect(normalizeName("fresh curry leaves")).toBe("curry leaves");
  });

  it("strips qualifier prefix 'ground'", () => {
    expect(normalizeName("ground turmeric")).toBe("turmeric");
  });

  it("strips only the first matching qualifier", () => {
    expect(normalizeName("fresh dried basil")).toBe("dried basil");
  });

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });

  it("resolves capsicum → bell pepper", () => {
    expect(normalizeName("capsicum")).toBe("bell pepper");
  });

  it("resolves coriander leaves → cilantro", () => {
    expect(normalizeName("coriander leaves")).toBe("cilantro");
  });

  it("resolves spring onion → green onion", () => {
    expect(normalizeName("spring onion")).toBe("green onion");
  });

  it("resolves scallion → green onion", () => {
    expect(normalizeName("scallion")).toBe("green onion");
  });

  it("resolves aubergine → eggplant", () => {
    expect(normalizeName("aubergine")).toBe("eggplant");
  });

  it("resolves courgette → zucchini", () => {
    expect(normalizeName("courgette")).toBe("zucchini");
  });

  it("does not strip 's' from words ending in 'ss'", () => {
    expect(normalizeName("grass")).toBe("grass");
  });

  it("does not strip 's' from hummus", () => {
    expect(normalizeName("hummus")).toBe("hummus");
  });

  it("does not strip 's' from couscous", () => {
    expect(normalizeName("couscous")).toBe("couscous");
  });

  it("does not strip 's' from asparagus", () => {
    expect(normalizeName("asparagus")).toBe("asparagus");
  });

  it("does not strip 's' from short words (≤3 chars)", () => {
    expect(normalizeName("bus")).toBe("bus");
  });
});

describe("classifyCategory", () => {
  it("classifies olive oil as oils_fats", () => {
    expect(classifyCategory("olive oil")).toBe("oils_fats");
  });

  it("classifies ghee as oils_fats", () => {
    expect(classifyCategory("ghee")).toBe("oils_fats");
  });

  it("classifies turmeric as spices_powders", () => {
    expect(classifyCategory("turmeric")).toBe("spices_powders");
  });

  it("classifies red chili powder as spices_powders", () => {
    expect(classifyCategory("red chili powder")).toBe("spices_powders");
  });

  it("classifies soy sauce as sauces_condiments", () => {
    expect(classifyCategory("soy sauce")).toBe("sauces_condiments");
  });

  it("classifies salt as basics", () => {
    expect(classifyCategory("salt")).toBe("basics");
  });

  it("classifies flour as basics", () => {
    expect(classifyCategory("flour")).toBe("basics");
  });

  it("defaults unknown items to other", () => {
    expect(classifyCategory("dragon fruit")).toBe("other");
  });

  // Keyword fallback tests
  it("classifies 'sesame seed' via keyword fallback (seed → spices)", () => {
    expect(classifyCategory("sesame seed")).toBe("spices_powders");
  });

  it("classifies 'chili paste' via keyword fallback (paste → sauces)", () => {
    expect(classifyCategory("chili paste")).toBe("sauces_condiments");
  });

  it("classifies 'rice vinegar' via direct lookup", () => {
    expect(classifyCategory("rice vinegar")).toBe("sauces_condiments");
  });

  it("classifies 'coconut oil' via keyword containment", () => {
    expect(classifyCategory("coconut oil")).toBe("oils_fats");
  });
});

describe("CATEGORY_LABELS", () => {
  it("has display names for all categories", () => {
    expect(CATEGORY_LABELS).toEqual({
      oils_fats: "Oils & fats",
      spices_powders: "Spices & powders",
      sauces_condiments: "Sauces & condiments",
      basics: "Basics",
      other: "Other",
    });
  });
});

describe("CATEGORY_ORDER", () => {
  it("lists categories in the expected order", () => {
    expect(CATEGORY_ORDER).toEqual([
      "oils_fats",
      "spices_powders",
      "sauces_condiments",
      "basics",
      "other",
    ]);
  });
});
