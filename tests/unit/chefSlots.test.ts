import { describe, it, expect, beforeEach } from "vitest";
import { loadChefSlots, saveChefSlots } from "@/lib/chefSlots";

describe("chefSlots", () => {
  beforeEach(() => localStorage.clear());

  it("returns 6 default slots when localStorage is empty", () => {
    const slots = loadChefSlots();
    expect(slots).toHaveLength(6);
    expect(slots[0]).toEqual({ type: "preset", chefId: "gordon-ramsay" });
    expect(slots[4]).toEqual({ type: "empty" });
  });

  it("returns saved slots from localStorage", () => {
    const custom = [
      { type: "preset" as const, chefId: "gordon-ramsay" },
      { type: "custom" as const, channelId: "UC123", channelName: "Test Chef" },
      { type: "empty" as const },
      { type: "empty" as const },
      { type: "empty" as const },
      { type: "empty" as const },
    ];
    saveChefSlots(custom);
    expect(loadChefSlots()).toEqual(custom);
  });

  it("returns defaults if localStorage has malformed data", () => {
    localStorage.setItem("ftt_chef_slots_v3", "not-json");
    expect(loadChefSlots()[0]).toEqual({ type: "preset", chefId: "gordon-ramsay" });
  });
});
