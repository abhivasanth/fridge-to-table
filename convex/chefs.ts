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

export const searchChefVideos = action({
  args: {
    ingredients: v.array(v.string()),
    chefs: v.array(chefValidator),
  },
  handler: async (_ctx, args) => {
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
    const query = args.ingredients.slice(0, 3).join(" ") + " recipe";

    // Search each chef's channel in parallel
    const results = await Promise.all(
      args.chefs.map(async (chef) => {
        try {
          const url = new URL("https://www.googleapis.com/youtube/v3/search");
          url.searchParams.set("key", apiKey);
          url.searchParams.set("channelId", chef.youtubeChannelId);
          url.searchParams.set("q", query);
          url.searchParams.set("type", "video");
          url.searchParams.set("maxResults", "3");
          url.searchParams.set("part", "snippet");
          url.searchParams.set("order", "relevance");

          const response = await fetch(url.toString());
          const data = await response.json();

          if (data.error) {
            console.error(`YouTube API error for ${chef.name}:`, data.error.message);
            return { chefId: chef.id, chefName: chef.name, chefEmoji: chef.emoji, found: false, videos: [] };
          }

          const items = data.items ?? [];
          const videos = items.map((item: any) => ({
            title: item.snippet.title as string,
            thumbnail: item.snippet.thumbnails.medium.url as string,
            videoId: item.id.videoId as string,
          }));

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
