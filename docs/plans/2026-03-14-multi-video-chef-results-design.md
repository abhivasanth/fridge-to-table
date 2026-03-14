# Multi-Video Chef Results

## Problem

Chef's Table search results show 1 video per chef. Users want to see up to 3 most relevant videos per chef to have more options when browsing recipes.

## Design

### Backend (`convex/chefs.ts`)

- Change `maxResults` from `"1"` to `"3"` in the YouTube API search call
- Return `videos: Array<{ title, thumbnail, videoId }>` instead of `video?: { title, thumbnail, videoId }`
- YouTube API with `order: "relevance"` naturally returns only matching videos — if a chef has 2 matches, only 2 are returned

### Types (`types/recipe.ts`)

- `ChefVideoResult.video?` → `ChefVideoResult.videos` (always present, 0-3 items)
- `found: boolean` derived from `videos.length > 0`

### Results Page (`app/chef-results/page.tsx`)

- Replace flat card grid with **section-per-chef layout**:
  - Chef header (emoji + name)
  - Video cards below in a responsive layout
- Mobile: video cards stack vertically within each chef section
- Desktop: video cards sit in a row (up to 3)
- Vertical scroll for the whole page — no horizontal scroll containers

### ChefVideoCard (`components/ChefVideoCard.tsx`)

- Simplified: renders one video (thumbnail + title + play icon)
- Chef identity (name/emoji) moves to section header — no longer on each card

### VideoModal (`components/VideoModal.tsx`)

- No changes — already accepts a single video and plays it

### Edge Cases

- 0 videos: show chef header + "No matching videos for these ingredients"
- 1-2 videos: show only what's returned, no padding
- 3+ from API: capped at 3 by `maxResults`

### What stays the same

- Search query logic (first 3 ingredients + "recipe")
- localStorage bridge (`chefTableResults`)
- Parallel per-chef API calls
- "Found X of Y chefs" summary
- Modal playback experience
