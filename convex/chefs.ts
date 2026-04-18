// Chef's Table backend — searches each selected chef's YouTube channel
// for videos matching the user's ingredients.
// Uses YouTube Data API v3 (server-side key, never exposed to browser).
import { action } from "./_generated/server";
import { v } from "convex/values";

const chefValidator = v.object({
  id: v.string(),
  name: v.string(),
  emoji: v.string(),
  youtubeChannelId: v.string(),
});

const PROTEINS = new Set([
  "chicken", "beef", "lamb", "mutton", "pork", "fish", "salmon", "shrimp",
  "prawns", "tofu", "paneer", "turkey", "duck", "goat", "tuna", "cod",
  "tilapia", "crab", "lobster", "scallops", "squid", "trout", "halibut",
  "swordfish", "venison", "bison", "rabbit", "octopus",
]);

function stemIngredient(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.endsWith("oes")) return w.slice(0, -2);   // tomatoes → tomato
  if (w.endsWith("ies")) return w.slice(0, -3) + "y"; // berries → berry
  if (w.endsWith("ches") || w.endsWith("shes")) return w.slice(0, -2); // peaches → peach, radishes → radish
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1); // noodles → noodle
  return w;
}

function titleContainsIngredient(title: string, ingredient: string): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerIng = ingredient.toLowerCase().trim();
  const isMultiWord = lowerIng.includes(" ");

  // Full phrase match (exact or stemmed form of each word)
  if (lowerTitle.includes(lowerIng)) return true;

  if (isMultiWord) {
    // Stem each word in the phrase independently and check if the full
    // stemmed phrase appears in the title
    const stemmedPhrase = lowerIng.split(" ").map(stemIngredient).join(" ");
    if (stemmedPhrase !== lowerIng && lowerTitle.includes(stemmedPhrase)) return true;
    // Multi-word ingredients must match as a phrase — no single-word fallback
    return false;
  }

  // Single-word ingredient: check against individual title words with stemming
  const stemmed = stemIngredient(lowerIng);
  const titleWords = lowerTitle.split(/[\s,\-–—|/()]+/);
  for (const tw of titleWords) {
    if (stemIngredient(tw) === stemmed) return true;
  }
  return false;
}

function stripHashtags(title: string): string {
  return title.replace(/#\S+/g, "").trim().toLowerCase();
}

export const searchChefVideos = action({
  args: {
    ingredients: v.array(v.string()),
    chefs: v.array(chefValidator),
  },
  handler: async (ctx, args) => {
    // Gate on auth — this action calls YouTube Data API once per chef (up to
    // 8 chefs per search, 100 quota units each). Leaving it open to anonymous
    // callers is a cost/DoS vector against the YouTube quota.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const apiKey = process.env.YOUTUBE_API_KEY;

    // Graceful degradation: if no API key, return empty results
    if (!apiKey) {
      console.error("YOUTUBE_API_KEY is not set in Convex environment");
      return args.chefs.map((chef) => ({
        chefId: chef.id,
        chefName: chef.name,
        chefEmoji: chef.emoji,
        found: false,
        videos: [],
      }));
    }

    // Build search query from the first 3 ingredients
    const topIngredients = args.ingredients.slice(0, 3);
    const query = topIngredients.join(" ") + " recipe";

    // Detect if any of the top ingredients is (or contains) a protein.
    // Stems the input ("chickens" → "chicken") and extracts the protein word
    // from multi-word ingredients ("chicken breast" → "chicken").
    let proteinWord: string | undefined;
    for (const ing of topIngredients) {
      const lower = ing.toLowerCase().trim();
      if (PROTEINS.has(lower)) { proteinWord = lower; break; }
      if (PROTEINS.has(stemIngredient(lower))) { proteinWord = stemIngredient(lower); break; }
      if (lower.includes(" ")) {
        for (const w of lower.split(" ")) {
          if (PROTEINS.has(w)) { proteinWord = w; break; }
          if (PROTEINS.has(stemIngredient(w))) { proteinWord = stemIngredient(w); break; }
        }
        if (proteinWord) break;
      }
    }

    // Search each chef's channel in parallel
    const results = await Promise.all(
      args.chefs.map(async (chef) => {
        try {
          const url = new URL("https://www.googleapis.com/youtube/v3/search");
          url.searchParams.set("key", apiKey);
          url.searchParams.set("channelId", chef.youtubeChannelId);
          url.searchParams.set("q", query);
          url.searchParams.set("type", "video");
          url.searchParams.set("maxResults", "6");
          url.searchParams.set("part", "snippet");
          url.searchParams.set("order", "relevance");

          const response = await fetch(url.toString());
          const data = await response.json();

          if (data.error) {
            console.error(`YouTube API error for ${chef.name}:`, data.error.message);
            return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false, videos: [] };
          }

          const items = (data.items ?? []).slice(0, 6);
          const allVideos: { title: string; thumbnail: string; videoId: string }[] = items.map((item: any) => ({
            title: item.snippet.title as string,
            thumbnail: item.snippet.thumbnails.medium.url as string,
            videoId: item.id.videoId as string,
          }));

          // Filter by ingredient relevance
          const filtered = allVideos.filter((video) => {
            if (proteinWord) {
              return titleContainsIngredient(video.title, proteinWord);
            }
            return topIngredients.some((ing) =>
              titleContainsIngredient(video.title, ing)
            );
          });

          // Deduplicate by normalized title
          const seen = new Set<string>();
          const deduped = filtered.filter((video) => {
            const key = stripHashtags(video.title);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          const videos = deduped.slice(0, 3);

          return {
            chefId: chef.id,
            chefName: chef.name,
            chefEmoji: chef.emoji,
            found: videos.length > 0,
            videos,
          };
        } catch (err) {
          console.error(`Chef search failed for ${chef.name}:`, err);
          return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false, videos: [] };
        }
      })
    );

    return results;
  },
});
