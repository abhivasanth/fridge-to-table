// lib/voiceInput.ts
// Web Speech API wrapper for voice ingredient input.
// Client-side only — never call isVoiceSupported() during SSR.

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}

export function createSpeechRecognition(): SpeechRecognition | null {
  if (!isVoiceSupported()) return null;
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  const recognition: SpeechRecognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  return recognition;
}
