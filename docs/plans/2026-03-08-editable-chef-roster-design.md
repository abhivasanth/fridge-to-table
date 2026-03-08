# Editable Chef Roster — Design Document

## Goal

Unify default chefs and custom chefs into a single manageable roster on the My Chefs page. Users curate which chefs (up to 8) appear on the Chef's Table grid, while retaining per-search toggle on the home page.

## Current State

- `lib/chefs.ts`: 8 hardcoded default chefs (`Chef` type: id, name, country, emoji, youtubeChannelId)
- `components/ChefGrid.tsx`: renders all 8 defaults with per-search multi-select toggle
- `app/my-chefs/page.tsx`: separate page for adding up to 6 custom chefs via YouTube URL (stored in Convex `customChefs` table)
- Custom chefs (`channelId, channelName, channelThumbnail`) never appear on Chef's Table
- Two unrelated selection systems: `SELECTED_CHEFS_KEY` (per-search toggles) and custom chefs (Convex)

## Architecture

### Unified Chef Type

```ts
// lib/chefs.ts — new type
type ChefSlot = {
  id: string;                    // default: "gordon-ramsay", custom: channelId
  name: string;                  // default: "Gordon Ramsay", custom: channelName
  youtubeChannelId: string;      // same for both
  isDefault: boolean;
  // Default chef fields
  emoji?: string;                // "🍳" — only defaults
  country?: string;              // "UK" — only defaults
  // Custom chef fields
  thumbnail?: string;            // YouTube avatar URL — only custom
};
```

### Data Flow

```
My Chefs page
  ├── Featured Chefs (lib/chefs.ts, 8, always present)
  ├── Your Chefs (Convex customChefs, 0–6, addable/removable)
  ├── Checkmark toggle on each chef (max 8 total checked)
  └── Writes checked IDs → localStorage "fridgeToTable_chefTableSlots"

Home page → Chef's Table tab
  ├── Reads slot IDs from localStorage
  ├── Merges with custom chefs from Convex to build ChefSlot[]
  ├── ChefGrid renders only slotted chefs
  └── Per-search toggle (SELECTED_CHEFS_KEY) is subset of slots
```

### localStorage Keys

| Key | Purpose | Default (new user) |
|-----|---------|-------------------|
| `fridgeToTable_chefTableSlots` | Which chefs appear on Chef's Table (max 8 IDs) | All 8 default chef IDs |
| `fridgeToTable_selectedChefs` | Per-search toggle within visible chefs (existing) | Empty (all shown = all usable) |

On load, `selectedChefs` is validated against `chefTableSlots` — any ID not in slots is removed.

### No Backend Changes

- Convex `customChefs` schema unchanged
- Slot selection stored in localStorage (consistent with existing pattern)
- `getSelectedChefs()` refactored to accept a merged chef list instead of filtering hardcoded array only

## Component Changes

### 1. `ChefGrid.tsx` — Updated

- Accepts `chefs: ChefSlot[]` prop instead of reading from hardcoded `CHEFS`
- Renders emoji for defaults, circular thumbnail for custom chefs
- "Choose your chefs" header gains "Edit chefs" text link (right-aligned, `#D4622A`, links to `/my-chefs`)
- Per-search toggle unchanged

### 2. `app/page.tsx` — Updated

- Reads `chefTableSlots` from localStorage
- Fetches custom chefs from Convex
- Merges defaults + custom chefs, filters to slotted IDs → passes to ChefGrid
- `getSelectedChefs` replaced: uses merged list directly
- Validates `selectedChefs` against current slots on load

### 3. `app/my-chefs/page.tsx` — Redesigned

**Layout:**

```
← Back to search

My Chefs
Manage your Chef's Table lineup (up to 8)

┌─────────────────────────────────────┐
│ FEATURED CHEFS                       │
│                                      │
│ [✓] 🍳 Gordon Ramsay · UK           │
│ [✓] 🍕 Jamie Oliver · UK            │
│ [✓] 🍛 Ranveer Brar · India         │
│ [ ] 🥢 Maangchi · Korea             │
│ ... (8 total, no remove button)      │
│                                      │
│ YOUR CHEFS                           │
│                                      │
│ [✓] [thumb] Babish · ✕              │
│ [ ] [thumb] Joshua Weissman · ✕     │
│ ... (0–6, with remove button)        │
│                                      │
│ [YouTube URL input] [Find]           │
│ (preview + add card)                 │
│                                      │
│ ⚠ Max 8 message (when applicable)   │
└─────────────────────────────────────┘
```

- Each chef row has a checkmark toggle (checked = appears on Chef's Table)
- Checking a 9th chef shows: "You can show up to 8 chefs on Chef's Table. Uncheck one to add another."
- Removing a custom chef auto-removes from slots and per-search selection
- Existing URL input + preview + add flow unchanged

### 4. `lib/chefs.ts` — Updated

- Add `ChefSlot` type export
- Add `toChefSlot(chef: Chef): ChefSlot` adapter for defaults
- Add `customToChefSlot(custom): ChefSlot` adapter for Convex chefs
- Keep `CHEFS` array and `Chef` type unchanged
- Remove or update `getSelectedChefs()` to work with `ChefSlot[]`

### 5. `lib/chefSlots.ts` — New

- `getSlotIds(): string[]` — reads from localStorage, defaults to all 8 default IDs
- `setSlotIds(ids: string[]): void` — writes to localStorage
- `MAX_CHEF_TABLE_SLOTS = 8`
- `validateSelectedChefs(selectedIds, slotIds): string[]` — removes stale IDs

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| New user, first visit | All 8 defaults in slots, no custom chefs |
| User unchecks all chefs | Chef's Table shows "Select at least one chef" (existing behavior) |
| User removes custom chef that's in slots | Auto-remove from slots + per-search selection |
| Custom chef channelId matches a default's youtubeChannelId | Prevent adding (already exists) |
| User has 8 checked, tries to check 9th | Show constraint message, don't check |
| User adds custom chef when <8 are checked | New chef is auto-checked into slots |

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/chefs.ts` | Add `ChefSlot` type, adapter functions |
| `lib/chefSlots.ts` | New — slot management utilities |
| `components/ChefGrid.tsx` | Accept `ChefSlot[]`, render thumbnails, add "Edit chefs" link |
| `app/page.tsx` | Merge chefs, read slots, pass to ChefGrid |
| `app/my-chefs/page.tsx` | Redesign with two sections + checkmark toggles |
| `components/CustomChefCard.tsx` | Add optional `checked`/`onToggle` props |
