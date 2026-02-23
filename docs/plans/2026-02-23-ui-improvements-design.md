# UI Improvements Design — Landing Page + UX Polish

**Date:** 2026-02-23
**Branch:** feature/v2

---

## Overview

Four improvements to the Fridge to Table app:
1. Voice button UX — redesigned to be prominent with waveform animation (like ChatGPT/Claude AI)
2. Filter placement — moved above the "Find Recipes" button
3. Chef loading animation — restored from v1, enhanced with cycling text
4. Landing page redesign — full marketing-style single-page layout with navbar, features section, and testimonials

---

## Architecture

### Navigation Restructure

Replace the global `BottomNav` in `layout.tsx` with a `ClientNav` component:
- On `/` (home) → renders `Navbar` (top navigation, desktop-style)
- On all other routes → renders `BottomNav` (bottom tabs, mobile-friendly)

### Page Structure (`app/page.tsx`)

Single scrolling page with 4 stacked sections:
1. **Navbar** — logo + Home, Favourites links + "Try Free" CTA
2. **Hero** — headline "What's in your fridge?", tagline
3. **App Playground** — existing tabs + input + filters + submit + loading animation
4. **Features Section** — "Why Fridge to Table?" with 4 cards
5. **Testimonials Section** — dark green bg, quotes, 4.9 star rating

---

## Section 1: Navbar + Logo

**Logo:** SVG mark — a stylised fork with a small leaf sprouting from the top, wordmark "Fridge to Table" in dark forest green. The word "to" rendered slightly lighter to create visual rhythm.

**Navbar:**
- Background: `#1A3A2A` (dark forest green)
- Left: logo mark + wordmark
- Right: `Home` link, `Favourites` link, `Try Free →` pill button (terracotta `#D4622A`)
- Mobile: hamburger or simplified (logo + links)

---

## Section 2: Hero

- Small badge: "AI-POWERED COOKING" in terracotta, small-caps
- H1: **"What's in"** (bold, dark green) + *"your fridge?"* (italic, terracotta) — split across two lines
- Tagline: "Tell us your ingredients — we'll find the perfect recipe."
- Subtle cream/warm gradient background (existing `#FAF6F1`)

Font: Add `Playfair Display` (Google Fonts, free) for hero headline and section headings to match the premium serif aesthetic from the reference screenshots.

---

## Section 3: App Playground (functional core)

### Voice Button Redesign
- **Remove** the mic emoji from inside the textarea
- **Add** a standalone pill button below the textarea: `[ 🎤 Speak your ingredients ]`
- **Recording state:** Button transforms to show 5 animated vertical bars (staggered CSS keyframe animation) + "Listening... tap to stop" text
- Animation: bars use `animate-bounce` with `animation-delay` utilities (100ms staggered)
- Stop: tap the button again to stop recording

### Filter Placement
- Add `beforeSubmit?: React.ReactNode` prop to `IngredientInput`
- Renders between the voice button and the submit button
- `page.tsx` passes `<FiltersPanel>` as that slot on the Any Recipe tab

### Chef Loading Animation
- When `isLoading` is true, replace the input form with a centred loading block:
  ```
            👨‍🍳   ← animate-bounce
  Checking your fridge...   ← cycles every 2s via useEffect/useState
  ```
- Text cycles through: "Checking your fridge...", "Consulting the chef...", "Almost ready..."
- Wraps in a `LoadingChef` component

---

## Section 4: Features ("Why Fridge to Table?")

Headline: **"Built around"** + *"how you cook"* (serif, italic accent)

2×2 card grid on cream background. Cards have rounded corners, soft shadow, pastel icon squares (matching reference screenshots):

| Icon bg | Icon | Title | Copy |
|---------|------|-------|------|
| Warm peach | 📸 | **Snap, speak, or type** | Snap a pic or type a short summary or say it out loud. |
| Soft sage | 👨‍🍳 | **Cook like your idols** | Recipes inspired by Gordon Ramsay, Jamie Oliver, and more. Real techniques. Your ingredients. One beautiful result. |
| Warm yellow | 🎯 | **Any skill, any night** | Filter from quick weeknight dinners to weekend showstoppers. Every recipe is designed to help you grow. |
| Soft lavender | ✨ | **Zero ads. Always.** | We're subscriber-funded. No sponsored recipes. No pop-ups. Just you and the food you love. |

---

## Section 5: Testimonials

- Background: `#1A3A2A` (dark forest green)
- Headline: **"Trusted by"** + *"thousands of food lovers"* (serif, gold accent `#C9A84C`)
- 3 testimonial cards on slightly lighter green (`#224232`)
- Gold stars (★★★★★)
- Bottom stat: **4.9** with "Average rating from our community"

**Testimonial copy:**
1. "I used to stare at my fridge for 20 minutes wondering what to cook. Now I just snap a photo and I've got three delicious options in seconds." — *Priya M., San Francisco*
2. "The Chef's Table feature is unreal. Getting Jamie Oliver-inspired recipes from what's actually in my kitchen? Game changer." — *Jake T., London*
3. "Finally an app that meets me where I am. I can type, talk, or take a picture — and it always gets it right." — *Aisha K., Toronto*

---

## Files Changed

| File | Change |
|------|--------|
| `app/layout.tsx` | Replace `BottomNav` with `ClientNav` |
| `app/page.tsx` | Full landing page restructure |
| `components/Navbar.tsx` | New top navbar component |
| `components/ClientNav.tsx` | New conditional nav (Navbar vs BottomNav) |
| `components/IngredientInput.tsx` | Voice button redesign, `beforeSubmit` slot |
| `components/LoadingChef.tsx` | New loading animation component |
| `app/globals.css` | Add Playfair Display font |

---

## Out of Scope

- Backend/Convex changes
- Recipe results pages
- Any new API integrations
