# Fridge to Table — v2 Design Document

**Version:** 2.0
**Date:** 2026-02-21
**Status:** Approved — ready for planning
**Supersedes:** `2026-02-19-fridge-to-table-design.md` (v1)
**Authors:** Product + Engineering

---

## Version History

| Version | Date | Document | Status |
|---|---|---|---|
| v1.0 | 2026-02-19 | `2026-02-19-fridge-to-table-design.md` | Shipped ✅ |
| v1.0 | 2026-02-20 | `2026-02-20-fridge-to-table.md` (impl plan) | Complete ✅ |
| **v2.0** | **2026-02-21** | **This document** | **In design** |

### Reverting to v1
The v1 codebase is permanently preserved via git tag:
```bash
git checkout v1.0.0          # inspect v1 code
git checkout -b hotfix/v1 v1.0.0  # branch from v1 for a hotfix
```
Production v1 remains live at https://fridge-to-table-mu.vercel.app until v2 is deployed and verified.

---

## Overview

Fridge to Table v2 elevates the app from a functional utility into a **premium food discovery experience**. The core ingredient-to-recipe flow remains intact. v2 adds two new recipe discovery modes — **Chef's Table** (real YouTube recipes from curated celebrity chef channels) and **voice input** — alongside a complete visual redesign.

v2 does not introduce user accounts, authentication, or social API integrations. These are deliberately deferred to v3 to validate the core product first.

---

## What Changed from v1

| Area | v1 | v2 |
|---|---|---|
| Visual design | Default Tailwind whites/greens | Premium cream/green/terracotta palette |
| Navigation | Footer link to favourites | Bottom nav bar (Home / Saved) |
| Recipe discovery | Claude AI only | Claude AI + Chef's Table (YouTube) |
| Ingredient input | Text + photo upload | Text + photo upload + voice |
| Photo input UI | Tab toggle (Type / Upload) | "+" button → Take photo / Upload |
| Diet filter | 3-button toggle (Veg/Vegan/Non-Veg) | Removed — Claude infers from ingredients |
| Filters | Cuisine, time, difficulty, diet | Cuisine, time (mins), difficulty only |
| Chef integration | None | Curated chef list, YouTube channel search |
| Auth | Anonymous (localStorage UUID) | Anonymous (unchanged) |
| YouTube | None | Chef's Table video results + detail thumbnails |

---

## Architecture & Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend + Routing | Next.js 16 (App Router) | Unchanged |
| Styling | Tailwind CSS | New design tokens added |
| Backend / DB | Convex (Actions, Mutations, Queries) | One new action added |
| AI | Claude Sonnet 4.6 | Unchanged |
| Voice | Web Speech API (browser-native) | No API key required |
| Video | YouTube Data API v3 | New — app-level key only, no OAuth |
| Hosting | Vercel + Convex | Unchanged |
| Language | TypeScript throughout | Unchanged |
| Tests | Vitest, React Testing Library, convex-test, Playwright | Unchanged methodology |

**Key architectural decisions carried forward from v1:**
- All Claude API calls inside Convex Actions — never in the browser
- Anonymous session identity via UUID in localStorage
- Next.js is a pure UI layer; all data logic in Convex
- Convex `"skip"` pattern for SSR-safe conditional queries

**New in v2:**
- YouTube Data API v3 called from a Convex Action (server-side only — API key never exposed to browser)
- Chef preferences stored in localStorage (no new Convex table needed)
- Voice transcription handled entirely client-side via Web Speech API

---

## Visual Design System

### Colour Palette

| Role | Colour | Tailwind equivalent |
|---|---|---|
| Page background | `#FAF6F1` warm ivory | `bg-[#FAF6F1]` |
| Primary headings | `#1A3A2A` deep forest green | `text-[#1A3A2A]` |
| CTA buttons | `#D4622A` burnt orange / terracotta | `bg-[#D4622A]` |
| Accent / chips | `#C8DFC8` soft sage green | `bg-[#C8DFC8]` |
| Cards | White `#FFFFFF` with warm shadow | `bg-white shadow-sm` |
| Body text | `#2D2D2D` near-black | `text-gray-800` |

### Typography
- **Font:** Inter (Google Fonts) — unchanged from v1
- **Accent style:** Italic weight for hero phrases (e.g. *"What's in your fridge?"*)
- **Scale:** Large, comfortable sizing — food apps demand legibility

### Shape & Motion
- Cards: `rounded-2xl` corners, generous padding
- Hover transitions: 150ms ease
- Active states: terracotta border ring on selection
- Loading: retained bouncing chef emoji 🍳

### Responsiveness
- Mobile-first; bottom nav is mobile-native
- Single column mobile → 2-col tablet → 3-col desktop (recipe grid unchanged)

---

## Navigation

### Bottom Navigation Bar (new)
Persistent across all pages. Two tabs only:

| Tab | Route | Icon |
|---|---|---|
| Home | `/` | 🏠 |
| Saved | `/favourites` | ❤️ |

No Profile tab. No Creators tab. YAGNI — these are deferred to v3 when accounts exist.

---

## Pages & User Flows

### `GET /` — Home Page (redesigned)

**Layout (top to bottom):**

```
┌────────────────────────────────────────┐
│  What's in your fridge?  (italic hero) │
│  [ Any Recipe ]  [ Chef's Table ]      │  ← tab selector
├────────────────────────────────────────┤
│  [ Type your ingredients...  +  🎙️ ]  │  ← input row
│                                        │
│  [CHEF GRID — only when Chef's Table   │  ← conditional
│   tab is active]                       │
│                                        │
│  ▼ Filters                             │  ← collapsible
│    (hidden when Chef's Table active)   │
│                                        │
│  [       Find Recipes →       ]        │  ← CTA
└────────────────────────────────────────┘
```

**Tab behaviour:**
- Tabs are mutually exclusive — selecting one deactivates the other
- Active tab uses terracotta underline + bold weight
- Switching tabs does not clear the ingredient input

**"+" button (photo input):**
Tapping "+" presents two options:
- 📷 Take a photo (opens device camera; hidden on desktop)
- 🖼️ Upload a photo (opens file picker)

Existing v1 photo compression logic (Canvas API, ≤1024px) and analyzePhoto Convex action are unchanged. Bug fix: investigate and resolve the production timeout causing "chef is busy" on photo analysis (see Known Issues).

**Voice input (🎙️ button):**
- Press → mic pulses red → user speaks freely
- Press again to stop → Web Speech API SpeechRecognition transcribes
- Transcript appears in the ingredient text field
- User reviews / edits → hits Find Recipes
- Browser support: Chrome and Edge (native). Firefox and iOS Safari have limited support — show a graceful "voice not supported in this browser" tooltip if SpeechRecognition is unavailable.

**Chef's Table tab — chef selector grid:**
Shown inline below the tab row when Chef's Table is active. Hidden when Any Recipe is active.

- 3-column avatar grid of curated celebrity chefs (TBD — to be decided separately, 6–8 chefs)
- Each card: circular emoji avatar + chef name
- Multi-select — user picks 1 to N chefs
- Selected state: terracotta border ring + light background tint
- At least 1 chef must be selected before Find Recipes activates
- Selections saved to localStorage (`selectedChefs`, `hasSelectedChefs`)
- On first visit: no chefs pre-selected, user must pick
- On return visits: previous selection is restored

**Filters panel (Any Recipe only):**
Hidden entirely when Chef's Table tab is active.

| Filter | Input type | Default |
|---|---|---|
| Cuisine / mood | Free text (e.g. "spicy", "Italian") | Empty |
| Max cooking time (mins) | 15 / 30 / 45 / 60+ buttons | 30 |
| Difficulty | Easy / Medium / Hard buttons | Easy |

Diet filter: **removed**. Claude infers dietary requirements from the ingredients provided. If the user inputs only plant-based ingredients, Claude generates plant-based recipes. If meat is present, Claude generates non-vegetarian recipes.

**Find Recipes button:**
- Disabled until: at least 1 ingredient entered AND (Any Recipe tab OR at least 1 chef selected on Chef's Table tab)
- Loading state: bouncing chef emoji 🍳

---

### `GET /results/[recipeSetId]` — Results Page

**Any Recipe tab results (unchanged from v1):**
- 3 recipe cards in responsive grid
- Each card: title, cuisine badge, difficulty badge, cooking time, description
- Click → recipe detail page

**Chef's Table tab results (new):**
- 1 video card per selected chef (up to N cards where N = number of chefs selected)
- Each card:
  - Chef name + avatar
  - YouTube video thumbnail
  - Video title
  - YouTube link (opens in new tab)
- "No result" state per chef (if YouTube search returns no strong match):

```
┌──────────────────────────┐
│  Chef Name               │
│  😕 No video found for   │
│  these ingredients.      │
│  Try different ones.     │
└──────────────────────────┘
```

Results are **not persisted to Convex** for Chef's Table — they are fetched fresh each search.

---

### `GET /recipe/[recipeSetId]/[recipeIndex]` — Recipe Detail (Any Recipe only)

Unchanged from v1 with one addition: this page does not apply to Chef's Table results (those link directly to YouTube).

---

### `GET /favourites` — Saved Favourites

Unchanged from v1. Accessible via bottom nav "Saved" tab.

---

## Chef's Table — Technical Design

### Curated Chef List
A hardcoded array of chef objects stored in the codebase (not in Convex):

```typescript
// lib/chefs.ts
type Chef = {
  id: string               // slug e.g. "gordon-ramsay"
  name: string             // display name e.g. "Gordon Ramsay"
  country: string          // e.g. "UK"
  emoji: string            // avatar emoji e.g. "🍳"
  youtubeChannelId: string // official YouTube channel ID — verified before implementation
}

export const CHEFS: Chef[] = [
  { id: "gordon-ramsay",       name: "Gordon Ramsay",       country: "UK",       emoji: "🍳", youtubeChannelId: "TBD" },
  { id: "jamie-oliver",        name: "Jamie Oliver",        country: "UK",       emoji: "🍕", youtubeChannelId: "TBD" },
  { id: "ranveer-brar",        name: "Ranveer Brar",        country: "India",    emoji: "🍛", youtubeChannelId: "TBD" },
  { id: "maangchi",            name: "Maangchi",            country: "Korea",    emoji: "🥢", youtubeChannelId: "TBD" },
  { id: "pati-jinich",         name: "Pati Jinich",         country: "Mexico",   emoji: "🌮", youtubeChannelId: "TBD" },
  { id: "kenji-lopez-alt",     name: "Kenji López-Alt",     country: "USA",      emoji: "🔬", youtubeChannelId: "TBD" },
  { id: "pailin-chongchitnant",name: "Pailin Chongchitnant",country: "Thailand", emoji: "🌶️", youtubeChannelId: "TBD" },
  { id: "lidia-bastianich",    name: "Lidia Bastianich",    country: "Italy",    emoji: "🍝", youtubeChannelId: "TBD" },
];
```

**Selection criteria met by all 8 chefs:**
- Elite but home-replicable cooking style
- Large YouTube channel with hundreds of uploads
- Culturally distinct — UK, India, Korea, Mexico, USA, Thailand, Italy
- Gender balanced — 4 male, 4 female

> **Note:** YouTube channel IDs marked TBD must be verified against each chef's official channel before implementation begins. Channel IDs are permanent — unlike usernames, they never change.

**Fits 2-column avatar grid on mobile (4 rows × 2 columns) — no awkward orphan card.**

### YouTube Data API Integration

**Convex Action:** `searchChefVideos`

```
Input:  ingredients: string[], chefChannelIds: string[]
Output: ChefVideoResult[] — one per chef
```

**Per chef search:**
```
YouTube Data API v3 — search.list
channelId: <chef's channel ID>
q: "<top 3 ingredients> recipe"
type: video
maxResults: 1
part: snippet
```

**Response shape per chef:**
```typescript
type ChefVideoResult = {
  chefId: string
  chefName: string
  found: boolean
  video?: {
    title: string
    thumbnail: string   // medium quality URL
    videoId: string     // for constructing https://youtube.com/watch?v=<id>
  }
}
```

**API key:** `YOUTUBE_API_KEY` stored in Convex environment variables. Never exposed to the browser.

**Quota:** YouTube Data API v3 free tier = 10,000 units/day. Each search costs 100 units = 100 chef searches/day free. Sufficient for development and early production. Monitor via Google Cloud Console.

**Search query construction:**
- Extract top 3 ingredients from the input list (first 3 by position)
- For Chef's Table detail page YouTube thumbnail: use `"<chef name> <recipe concept from ingredients> recipe"` for a more targeted search

---

## Voice Input — Technical Design

Uses the browser's native `SpeechRecognition` API (no external service, no API key):

```typescript
// lib/voiceInput.ts
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

// Feature detection
export const isVoiceSupported = () => typeof SpeechRecognition !== "undefined";
```

**UX states:**
- `idle` — mic icon, tappable
- `recording` — pulsing red animation, tap to stop
- `processing` — brief spinner while transcript is finalised
- `done` — transcript inserted into text field
- `unsupported` — mic icon is greyed out with tooltip "Voice not supported in this browser"

**Accuracy note:** SpeechRecognition handles ingredient names reasonably well in English. For non-English ingredients, accuracy may vary — the text field remains editable so users can correct transcription errors before submitting.

---

## Data Model

### Convex Schema Changes
No new tables. The `diet` field in the `recipes` table remains `v.optional()` for backwards compatibility with v1 records — it simply will not be set by v2 clients.

### localStorage Changes

| Key | Type | v1 | v2 |
|---|---|---|---|
| `fridgeToTable_sessionId` | `string` | ✅ Exists | ✅ Unchanged |
| `fridgeToTable_selectedChefs` | `string[]` | — | ✅ New |
| `fridgeToTable_hasSelectedChefs` | `boolean` | — | ✅ New |

### New Convex Action
`searchChefVideos` — server-side YouTube Data API call. No DB write. Stateless.

### New Convex Environment Variable
`YOUTUBE_API_KEY` — YouTube Data API v3 key from Google Cloud Console.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Voice not supported (Firefox/Safari) | Mic button greyed out, tooltip explains |
| Voice transcript empty | Field stays empty, user can type instead |
| Photo analysis timeout (v1 bug fix) | Investigate root cause; show clear retry message |
| YouTube API quota exceeded | Show "Video search unavailable right now" — non-blocking |
| Chef YouTube search returns no results | Per-chef graceful "no video found" card |
| All chef searches return no results | Show empty state with "Try different ingredients" CTA |
| YouTube API key missing/invalid | Log server-side; return empty results gracefully |
| No chefs selected on Chef's Table | Find Recipes button stays disabled |
| General Claude API failure | Unchanged from v1: "Our chef is taking a break" |

---

## Known Issues Carried from v1 (to fix in v2)

| Issue | Root cause hypothesis | Fix approach |
|---|---|---|
| Photo upload: "chef is busy" in production | Two-step analyzePhoto → generateRecipes chain likely hits Convex action timeout | Investigate action duration limits; consider combining into single action or increasing timeout |

---

## Testing Strategy

All features follow TDD: failing test → minimal implementation → green → commit.

### New unit tests
- `voiceInput.test.ts` — feature detection, state transitions, unsupported browser handling
- `chefs.test.ts` — chef data shape validation, channel ID format

### New integration tests
- `searchChefVideos.test.ts` — mocked YouTube API, correct query construction per chef, graceful no-result handling

### New E2E tests (Playwright)
- `chef-table.spec.ts` — chef selection persists in localStorage, video cards appear on results, "no result" state renders correctly
- `voice-input.spec.ts` — mic button visible, graceful degradation when SpeechRecognition unavailable

### Regression tests (v1 features must still pass)
- All existing unit, integration, and E2E tests must remain green throughout v2 development

---

## Deployment

### Infrastructure
Unchanged: Vercel (frontend) + Convex (backend).

### New environment variables required

| Variable | Where | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | Convex (dev + prod) | YouTube Data API v3 key |

All existing variables (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `ANTHROPIC_API_KEY`) unchanged.

### Deploy command
```bash
npx vercel --prod
```

### Version tagging convention
```bash
git tag -a v2.0.0 -m "v2.0.0 — description" # tag on completion
```

---

## What is NOT in v2 (deferred to v3)

| Feature | Reason deferred |
|---|---|
| User authentication / accounts | Validate product-market fit first |
| YouTube OAuth (real subscription data) | Requires accounts |
| AI transcript → recipe card summary | Phase 2 of YouTube feature |
| Instagram integration | Requires accounts + OAuth |
| Curated food influencer channels | Deferred with YouTube OAuth |
| Recipe history (past searches) | Requires accounts |
| Share recipe via URL | Lower priority |
| Nutritional information | Lower priority |
| Quick Add ingredient chips | Removed — regional ingredients vary too much |
| Diet category filter | Removed — Claude infers from ingredients |
| Profile page | Nothing meaningful to show without accounts |
| Creators management tab | Nothing meaningful without accounts |

---

## Constraints & Principles

- **YAGNI ruthlessly** — no features until proven necessary
- **TDD** — failing test before every implementation
- **Anonymous sessions preserved** — no breaking change to existing users
- **v1 always recoverable** — git tag `v1.0.0` is permanent; v1 docs preserved
- **No OAuth in v2** — YouTube integration uses app-level API key only
- **Claude infers diet** — ingredient list is the only diet signal
- **Chef list is TBD** — specific chefs and channel IDs to be confirmed before implementation begins
- **Evidence before claims** — no task is "done" without running verification and showing output
