import { describe, it, expect } from "vitest";
import { parseYouTubeInput } from "@/lib/parseYouTubeUrl";

describe("parseYouTubeInput", () => {
  it("parses a bare @handle", () => {
    expect(parseYouTubeInput("@babish")).toEqual({ type: "handle", value: "babish" });
  });

  it("parses youtube.com/@handle URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/@babish")).toEqual({
      type: "handle",
      value: "babish",
    });
  });

  it("parses youtube.com/@handle without https", () => {
    expect(parseYouTubeInput("youtube.com/@babish")).toEqual({
      type: "handle",
      value: "babish",
    });
  });

  it("parses youtube.com/channel/UCxxxxxx URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/channel/UCIEv3lZ_tNXHzL3ox-_uUGQ")).toEqual({
      type: "channelId",
      value: "UCIEv3lZ_tNXHzL3ox-_uUGQ",
    });
  });

  it("returns error for youtube.com/c/vanity URL", () => {
    expect(parseYouTubeInput("https://www.youtube.com/c/BabishCulinaryUniverse")).toEqual({
      type: "error",
    });
  });

  it("returns error for non-YouTube URL", () => {
    expect(parseYouTubeInput("https://www.google.com")).toEqual({ type: "error" });
  });

  it("returns error for plain text with no @ or URL", () => {
    expect(parseYouTubeInput("gordon ramsay")).toEqual({ type: "error" });
  });

  it("returns error for empty string", () => {
    expect(parseYouTubeInput("")).toEqual({ type: "error" });
  });

  it("handles @handle with dots and hyphens", () => {
    expect(parseYouTubeInput("@kenji-lopez-alt")).toEqual({
      type: "handle",
      value: "kenji-lopez-alt",
    });
  });
});
