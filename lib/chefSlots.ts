// lib/chefSlots.ts
// Manages which chefs appear on the Chef's Table grid (max 8).
// Stored in localStorage. Defaults to all 8 built-in chefs on first visit.
import { DEFAULT_CHEF_IDS } from "@/lib/chefs";

const SLOT_KEY = "fridgeToTable_chefTableSlots";
export const MAX_CHEF_TABLE_SLOTS = 8;

export function getSlotIds(): string[] {
  if (typeof window === "undefined") return DEFAULT_CHEF_IDS;
  const stored = localStorage.getItem(SLOT_KEY);
  if (!stored) return DEFAULT_CHEF_IDS;
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : DEFAULT_CHEF_IDS;
  } catch {
    return DEFAULT_CHEF_IDS;
  }
}

export function setSlotIds(ids: string[]): void {
  localStorage.setItem(SLOT_KEY, JSON.stringify(ids));
}

// Remove stale IDs from per-search selection that aren't in current slots.
export function validateSelectedChefs(selectedIds: string[], slotIds: string[]): string[] {
  return selectedIds.filter((id) => slotIds.includes(id));
}
