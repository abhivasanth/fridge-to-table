// Unit tests for the chef video filtering logic in convex/chefs.ts
// Tests the pure functions: stemIngredient, titleContainsIngredient, stripHashtags
// and the filtering/dedup pipeline against the spec's expected outcomes.

import assert from "node:assert";

// ── Copy of pure functions from convex/chefs.ts ──────────────────────────────

const PROTEINS = new Set([
  "chicken", "beef", "lamb", "mutton", "pork", "fish", "salmon", "shrimp",
  "prawns", "tofu", "paneer", "turkey", "duck", "goat", "tuna", "cod",
  "tilapia", "crab", "lobster", "scallops", "squid", "trout", "halibut",
  "swordfish", "venison", "bison", "rabbit", "octopus",
]);

function stemIngredient(word) {
  const w = word.toLowerCase().trim();
  if (w.endsWith("oes")) return w.slice(0, -2);
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.endsWith("ches") || w.endsWith("shes")) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

function titleContainsIngredient(title, ingredient) {
  const lowerTitle = title.toLowerCase();
  const lowerIng = ingredient.toLowerCase().trim();
  const isMultiWord = lowerIng.includes(" ");

  if (lowerTitle.includes(lowerIng)) return true;

  if (isMultiWord) {
    const stemmedPhrase = lowerIng.split(" ").map(stemIngredient).join(" ");
    if (stemmedPhrase !== lowerIng && lowerTitle.includes(stemmedPhrase)) return true;
    return false;
  }

  const stemmed = stemIngredient(lowerIng);
  const titleWords = lowerTitle.split(/[\s,\-–—|/()]+/);
  for (const tw of titleWords) {
    if (stemIngredient(tw) === stemmed) return true;
  }
  return false;
}

function stripHashtags(title) {
  return title.replace(/#\S+/g, "").trim().toLowerCase();
}

function filterVideos(allVideos, topIngredients) {
  const proteinIngredient = topIngredients.find((ing) =>
    PROTEINS.has(ing.toLowerCase().trim())
  );

  const filtered = allVideos.filter((video) => {
    if (proteinIngredient) {
      return titleContainsIngredient(video.title, proteinIngredient);
    }
    return topIngredients.some((ing) =>
      titleContainsIngredient(video.title, ing)
    );
  });

  const seen = new Set();
  const deduped = filtered.filter((video) => {
    const key = stripHashtags(video.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.slice(0, 3);
}

// ── Test helpers ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
  }
}

function v(title) {
  return { title, thumbnail: "thumb.jpg", videoId: title.slice(0, 8) };
}

// ── stemIngredient tests ─────────────────────────────────────────────────────

console.log("\nstemIngredient:");

test("tomatoes → tomato", () => {
  assert.strictEqual(stemIngredient("tomatoes"), "tomato");
});

test("potatoes → potato", () => {
  assert.strictEqual(stemIngredient("potatoes"), "potato");
});

test("noodles → noodle", () => {
  assert.strictEqual(stemIngredient("noodles"), "noodle");
});

test("onions → onion", () => {
  assert.strictEqual(stemIngredient("onions"), "onion");
});

test("berries → berry", () => {
  assert.strictEqual(stemIngredient("berries"), "berry");
});

test("olives → olive (not olf)", () => {
  assert.strictEqual(stemIngredient("olives"), "olive");
});

test("chives → chive (not chf)", () => {
  assert.strictEqual(stemIngredient("chives"), "chive");
});

test("sauces → sauce (via generic s rule)", () => {
  assert.strictEqual(stemIngredient("sauces"), "sauce");
});

test("peaches → peach", () => {
  assert.strictEqual(stemIngredient("peaches"), "peach");
});

test("radishes → radish", () => {
  assert.strictEqual(stemIngredient("radishes"), "radish");
});

test("chicken stays chicken (no double-strip)", () => {
  assert.strictEqual(stemIngredient("chicken"), "chicken");
});

test("grass stays grass (ss ending)", () => {
  assert.strictEqual(stemIngredient("grass"), "grass");
});

test("eggs → egg", () => {
  assert.strictEqual(stemIngredient("eggs"), "egg");
});

// ── titleContainsIngredient tests ────────────────────────────────────────────

console.log("\ntitleContainsIngredient:");

test("exact match: chicken in 'Korean Chicken Noodle Soup'", () => {
  assert.ok(titleContainsIngredient("Korean Chicken Noodle Soup", "chicken"));
});

test("stemmed match: tomatoes matches 'tomato sauce pasta'", () => {
  assert.ok(titleContainsIngredient("tomato sauce pasta", "tomatoes"));
});

test("stemmed match: noodle matches title with 'noodles'", () => {
  assert.ok(titleContainsIngredient("Spicy Noodles with Garlic", "noodle"));
});

test("case insensitive: SALMON matches 'Pan Seared Salmon'", () => {
  assert.ok(titleContainsIngredient("Pan Seared Salmon", "SALMON"));
});

test("no match: lamb not in 'Beef Soup with Ox Bone'", () => {
  assert.ok(!titleContainsIngredient("Beef Soup with Ox Bone", "lamb"));
});

test("no match: salmon not in 'Lemon Sole with Butter'", () => {
  assert.ok(!titleContainsIngredient("Lemon Sole with Butter", "salmon"));
});

test("no match: salmon not in 'Seabass with Herbs'", () => {
  assert.ok(!titleContainsIngredient("Seabass with Herbs", "salmon"));
});

test("multi-word: 'soy sauce' matches 'Tofu with Soy Sauce'", () => {
  assert.ok(titleContainsIngredient("Tofu with Soy Sauce", "soy sauce"));
});

test("multi-word: 'soy sauce' does NOT match 'Soy Bean Paste Soup'", () => {
  assert.ok(!titleContainsIngredient("Soy Bean Paste Soup", "soy sauce"));
});

test("multi-word: 'soy sauce' does NOT match 'Soy Milk Noodles'", () => {
  assert.ok(!titleContainsIngredient("Soy Milk Noodles", "soy sauce"));
});

test("multi-word: 'fish sauce' matches 'Thai Fish Sauce Chicken'", () => {
  assert.ok(titleContainsIngredient("Thai Fish Sauce Chicken", "fish sauce"));
});

test("multi-word: 'fish sauce' does NOT match 'Fish Tacos'", () => {
  assert.ok(!titleContainsIngredient("Fish Tacos", "fish sauce"));
});

// ── Protein detection tests ──────────────────────────────────────────────────

console.log("\nProtein detection:");

test("chicken is a protein", () => {
  assert.ok(PROTEINS.has("chicken"));
});

test("tofu is a protein", () => {
  assert.ok(PROTEINS.has("tofu"));
});

test("eggs is NOT a protein", () => {
  assert.ok(!PROTEINS.has("eggs"));
  assert.ok(!PROTEINS.has("egg"));
});

test("tomatoes is NOT a protein", () => {
  assert.ok(!PROTEINS.has("tomatoes"));
});

// ── filterVideos pipeline tests (spec test cases) ────────────────────────────

console.log("\nfilterVideos pipeline:");

test("chicken, rice, broccoli: filters out non-chicken videos", () => {
  const videos = [
    v("Korean Chicken Stew"),
    v("Kimchi Fried Rice"),
    v("Garlic Green Beans"),
    v("Chicken Noodle Soup"),
    v("Spicy Chicken Wings"),
    v("Beef Bulgogi"),
  ];
  const result = filterVideos(videos, ["chicken", "rice", "broccoli"]);
  assert.ok(result.every((r) => r.title.toLowerCase().includes("chicken")));
  assert.ok(result.length <= 3);
  assert.ok(!result.some((r) => r.title.includes("Kimchi")));
  assert.ok(!result.some((r) => r.title.includes("Green Beans")));
  assert.ok(!result.some((r) => r.title.includes("Beef")));
});

test("lamb, potatoes, onions: filters out beef/ox bone videos", () => {
  const videos = [
    v("Beef Soup"),
    v("Ox Bone Soup"),
    v("Kimchi Stew"),
    v("Spicy Pork"),
    v("Lamb Curry"),
    v("Rice Bowl"),
  ];
  const result = filterVideos(videos, ["lamb", "potatoes", "onions"]);
  // Only Lamb Curry should survive (protein = lamb)
  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].title, "Lamb Curry");
});

test("salmon, lemon, dill: filters out non-salmon fish", () => {
  const videos = [
    v("Lemon Sole with Butter"),
    v("Seabass with Herbs"),
    v("Pan Seared Salmon"),
    v("Salmon en Croute"),
    v("Garlic Bread"),
    v("Lemon Tart"),
  ];
  const result = filterVideos(videos, ["salmon", "lemon", "dill"]);
  assert.ok(result.every((r) => r.title.toLowerCase().includes("salmon")));
  assert.ok(!result.some((r) => r.title.includes("Sole")));
  assert.ok(!result.some((r) => r.title.includes("Seabass")));
});

test("pasta, tomatoes, garlic: no protein, flexible match on any ingredient", () => {
  const videos = [
    v("Spaghetti with Tomato Sauce"),
    v("Garlic Bread"),
    v("Pasta Primavera"),
    v("Chocolate Cake"),
    v("Ice Cream"),
    v("Tomato Basil Soup"),
  ];
  const result = filterVideos(videos, ["pasta", "tomatoes", "garlic"]);
  // Should match spaghetti (tomato), garlic bread (garlic), pasta primavera (pasta), tomato basil soup (tomato)
  // But capped at 3
  assert.strictEqual(result.length, 3);
  assert.ok(!result.some((r) => r.title.includes("Chocolate")));
  assert.ok(!result.some((r) => r.title.includes("Ice Cream")));
});

test("soy sauce, tofu, mushrooms: tofu is protein, filters on tofu", () => {
  const videos = [
    v("Soy Bean Paste Soup"),
    v("Crispy Tofu Bowl"),
    v("Mushroom Risotto"),
    v("Tofu Stir Fry"),
    v("Beef Stew"),
    v("Tofu Scramble"),
  ];
  const result = filterVideos(videos, ["soy sauce", "tofu", "mushrooms"]);
  assert.ok(result.every((r) => r.title.toLowerCase().includes("tofu")));
  assert.ok(!result.some((r) => r.title.includes("Soy Bean")));
  assert.ok(!result.some((r) => r.title.includes("Mushroom Risotto")));
});

test("eggs, tomatoes, onions: eggs NOT a protein, flexible match", () => {
  const videos = [
    v("Egg Tomato Stir Fry"),
    v("Onion Soup"),
    v("Tomato Salad"),
    v("Chocolate Mousse"),
    v("Banana Bread"),
    v("French Omelette"),
  ];
  const result = filterVideos(videos, ["eggs", "tomatoes", "onions"]);
  // egg, tomato, onion all match flexibly
  assert.ok(result.length >= 2);
  assert.ok(!result.some((r) => r.title.includes("Chocolate")));
  assert.ok(!result.some((r) => r.title.includes("Banana")));
});

test("potatoes, spinach, tomatoes: no protein, flexible match", () => {
  const videos = [
    v("Spinach Potato Curry"),
    v("Tomato Basil Pasta"),
    v("Chicken Tikka"),
    v("Potato Gratin"),
    v("Ice Cream Sundae"),
    v("Spinach Dip"),
  ];
  const result = filterVideos(videos, ["potatoes", "spinach", "tomatoes"]);
  assert.ok(result.length === 3);
  assert.ok(!result.some((r) => r.title.includes("Chicken")));
  assert.ok(!result.some((r) => r.title.includes("Ice Cream")));
});

// ── Deduplication tests ──────────────────────────────────────────────────────

console.log("\nDeduplication:");

test("exact duplicate titles after stripping hashtags are removed", () => {
  const videos = [
    v("Chicken Stew #shorts"),
    v("Chicken Stew #recipe"),
    v("Chicken Curry"),
  ];
  const result = filterVideos(videos, ["chicken", "rice", "broccoli"]);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].title, "Chicken Stew #shorts");
  assert.strictEqual(result[1].title, "Chicken Curry");
});

test("similar but different titles are both kept", () => {
  const videos = [
    v("Chicken Stew with Vegetables"),
    v("Chicken Stew Korean Style"),
    v("Chicken Curry"),
  ];
  const result = filterVideos(videos, ["chicken", "rice", "broccoli"]);
  assert.strictEqual(result.length, 3);
});

// ── stripHashtags tests ─────────────────────────────────────────────────────

console.log("\nstripHashtags:");

test("removes single hashtag", () => {
  assert.strictEqual(stripHashtags("Chicken Stew #shorts"), "chicken stew");
});

test("removes multiple hashtags", () => {
  assert.strictEqual(stripHashtags("Chicken Stew #shorts #recipe #cooking"), "chicken stew");
});

test("no hashtags returns lowercased trimmed title", () => {
  assert.strictEqual(stripHashtags("Chicken Stew"), "chicken stew");
});

// ── Edge cases ───────────────────────────────────────────────────────────────

console.log("\nEdge cases:");

test("all 6 videos filtered out → empty array, found=false scenario", () => {
  const videos = [
    v("Beef Soup"),
    v("Pork Belly"),
    v("Chocolate Cake"),
    v("Ice Cream"),
    v("Banana Bread"),
    v("Rice Pudding"),
  ];
  const result = filterVideos(videos, ["lamb", "potatoes", "onions"]);
  assert.strictEqual(result.length, 0);
});

test("more than 3 matches → capped at 3", () => {
  const videos = [
    v("Chicken Stew"),
    v("Chicken Curry"),
    v("Chicken Soup"),
    v("Chicken Wings"),
    v("Chicken Tikka"),
  ];
  const result = filterVideos(videos, ["chicken", "rice", "broccoli"]);
  assert.strictEqual(result.length, 3);
});

test("return shape has title, thumbnail, videoId", () => {
  const videos = [v("Chicken Stew")];
  const result = filterVideos(videos, ["chicken", "rice", "broccoli"]);
  assert.ok("title" in result[0]);
  assert.ok("thumbnail" in result[0]);
  assert.ok("videoId" in result[0]);
});

// ── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
