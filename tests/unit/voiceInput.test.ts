import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isVoiceSupported, createSpeechRecognition } from "@/lib/voiceInput";

describe("isVoiceSupported", () => {
  it("returns false when window is undefined (SSR)", () => {
    const original = global.window;
    // @ts-expect-error
    delete global.window;
    expect(isVoiceSupported()).toBe(false);
    global.window = original;
  });

  it("returns false when SpeechRecognition is absent", () => {
    // jsdom doesn't have SpeechRecognition by default
    expect(isVoiceSupported()).toBe(false);
  });

  it("returns true when SpeechRecognition is present", () => {
    (window as any).SpeechRecognition = vi.fn();
    expect(isVoiceSupported()).toBe(true);
    delete (window as any).SpeechRecognition;
  });

  it("returns true when webkitSpeechRecognition is present", () => {
    (window as any).webkitSpeechRecognition = vi.fn();
    expect(isVoiceSupported()).toBe(true);
    delete (window as any).webkitSpeechRecognition;
  });
});

describe("createSpeechRecognition", () => {
  it("returns null when voice is not supported", () => {
    expect(createSpeechRecognition()).toBeNull();
  });
});
