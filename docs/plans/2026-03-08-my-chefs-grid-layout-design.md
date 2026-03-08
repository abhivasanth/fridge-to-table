# My Chefs Page — Compact Grid Layout Design

## Goal

Redesign the My Chefs page from a vertical list to a compact grid layout, reducing scrolling and matching the visual language of the Chef's Table grid on the home page.

## Current State

- Featured Chefs (8) and Your Chefs (0-6) are stacked as full-width rows
- Each row has checkmark toggle, emoji/thumbnail, name, country
- Long page requiring significant scrolling, especially on mobile

## Design

### Layout Structure

- **Header:** unchanged (back link, title, subtitle, counter, warning)
- **Featured Chefs:** 2-col (mobile) / 4-col (desktop) grid of compact cards
- **Your Chefs:** same grid, with remove button + YouTube URL input below

### Card Design

**Featured Chef Card:**
- Emoji centered, name below, country below name
- Orange border (`border-[#D4622A]` + `bg-orange-50`) when selected
- Gray border (`border-gray-200` + `bg-white`) when not
- Small filled checkmark circle (orange with white tick) in top-right corner when selected
- No remove button

**Custom Chef Card:**
- Circular thumbnail centered, name below
- Same border/checkmark pattern as featured
- Small X button always visible in top-right (to the left of checkmark if selected)

### Responsive Grid

- Mobile (<768px): `grid-cols-2`
- Desktop (>=768px): `grid-cols-4`

### No Functional Changes

- Toggle logic, slot management, add/remove, URL input flow — all unchanged
- Pure layout/visual refactor
