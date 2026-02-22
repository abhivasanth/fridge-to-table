import { describe, it, expect } from "vitest";
import { CHEFS, getSelectedChefs } from "@/lib/chefs";

describe("CHEFS", () => {
  it("has exactly 8 chefs", () => {
    expect(CHEFS).toHaveLength(8);
  });

  it("each chef has required fields", () => {
    for (const chef of CHEFS) {
      expect(chef.id).toBeTruthy();
      expect(chef.name).toBeTruthy();
      expect(chef.country).toBeTruthy();
      expect(chef.emoji).toBeTruthy();
      expect(chef.youtubeChannelId).toBeTruthy();
      expect(chef.youtubeChannelId).not.toBe("TBD");
    }
  });

  it("has no duplicate IDs", () => {
    const ids = CHEFS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getSelectedChefs", () => {
  it("returns chefs matching the given IDs", () => {
    const result = getSelectedChefs(["gordon-ramsay", "maangchi"]);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain("gordon-ramsay");
    expect(result.map((c) => c.id)).toContain("maangchi");
  });

  it("returns empty array for no matching IDs", () => {
    expect(getSelectedChefs(["not-a-real-id"])).toHaveLength(0);
  });
});
