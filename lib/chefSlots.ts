import type { ChefSlot } from "@/types/v3";

export const CHEF_SLOTS_STORAGE_KEY = "ftt_chef_slots_v3";
const STORAGE_KEY = CHEF_SLOTS_STORAGE_KEY;

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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 6) return DEFAULT_SLOTS;
    const validTypes = new Set(["preset", "custom", "empty"]);
    if (!parsed.every((s: unknown) => typeof s === "object" && s !== null && validTypes.has((s as { type?: unknown }).type as string))) {
      return DEFAULT_SLOTS;
    }
    return parsed as ChefSlot[];
  } catch {
    return DEFAULT_SLOTS;
  }
}

export function saveChefSlots(slots: ChefSlot[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
}
