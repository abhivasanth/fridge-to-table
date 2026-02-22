// lib/voiceInput.ts
// Web Speech API wrapper for voice ingredient input.
// Client-side only — never call isVoiceSupported() during SSR.

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createSpeechRecognition(): any {
  if (!isVoiceSupported()) return null;
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  return recognition;
}
