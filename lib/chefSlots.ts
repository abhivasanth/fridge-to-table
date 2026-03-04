import type { ChefSlot } from "@/types/v3";

const STORAGE_KEY = "ftt_chef_slots_v3";

const DEFAULT_SLOTS: ChefSlot[] = [
  { type: "preset", chefId: "gordon-ramsay" },
  { type: "preset", chefId: "jamie-oliver" },
  { type: "preset", chefId: "ranveer-brar" },
  { type: "preset", chefId: "maangchi" },
  { type: "empty" },
  { type: "empty" },
];

export function loadChefSlots(): ChefSlot[] {
  if (typeof window === "undefined") return DEFAULT_SLOTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw) as ChefSlot[];
    if (!Array.isArray(parsed) || parsed.length !== 6) return DEFAULT_SLOTS;
    return parsed;
  } catch {
    return DEFAULT_SLOTS;
  }
}

export function saveChefSlots(slots: ChefSlot[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}
