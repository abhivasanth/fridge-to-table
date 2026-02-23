"use client";
import { useState, useRef, useEffect } from "react";
import { parseIngredients } from "@/lib/ingredientParser";
import { compressImage } from "@/lib/imageCompression";
import { isVoiceSupported, createSpeechRecognition } from "@/lib/voiceInput";

type Props = {
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  beforeSubmit?: React.ReactNode;
};

export function IngredientInput({ onSubmit, isLoading, disabled, beforeSubmit }: Props) {
  const [text, setText] = useState("");
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "recording">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  // isVoiceSupported() reads window — must be deferred to avoid SSR/client hydration mismatch
  const [voiceSupported, setVoiceSupported] = useState(false);
  useEffect(() => {
    setVoiceSupported(isVoiceSupported());
  }, []);
  const ingredients = parseIngredients(text);
  const hasInput = ingredients.length > 0 || preview !== null;

  // Close photo menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (photoMenuRef.current && !photoMenuRef.current.contains(e.target as Node)) {
        setShowPhotoMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handlePhotoFile(file: File) {
    setShowPhotoMenu(false);
    if (!file.type.startsWith("image/")) return;
    const base64 = await compressImage(file);
    setPreview(base64);
    setText("");
  }

  function handleMicClick() {
    if (voiceState === "recording") {
      recognitionRef.current?.stop();
      setVoiceState("idle");
      return;
    }
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;
    recognition.onstart = () => setVoiceState("recording");
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setText((prev) => (prev ? prev + ", " + transcript : transcript));
    };
    recognition.onend = () => setVoiceState("idle");
    recognition.onerror = () => setVoiceState("idle");
    recognition.start();
  }

  function handleSubmit() {
    if (preview) {
      onSubmit([], preview);
    } else {
      onSubmit(ingredients);
    }
  }

  return (
    <div className="space-y-4">
      {/* Photo preview */}
      {preview && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Fridge photo" className="w-full rounded-2xl object-cover max-h-48" />
          <button
            onClick={() => setPreview(null)}
            className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm"
            aria-label="Remove photo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Text input + photo + mic */}
      {!preview && (
        <div className="relative flex items-start gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your ingredients, e.g. eggs, spinach, tomatoes..."
            className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-14 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:border-[#D4622A] min-h-[56px]"
            rows={2}
          />

          {/* Inline buttons (absolute positioned inside textarea) */}
          <div className="absolute right-3 top-3 flex items-center gap-2">
            {/* Photo "+" button */}
            <div className="relative" ref={photoMenuRef}>
              <button
                type="button"
                onClick={() => setShowPhotoMenu((v) => !v)}
                className="text-gray-400 hover:text-[#D4622A] transition-colors text-xl leading-none"
                aria-label="Add photo"
              >
                +
              </button>
              {showPhotoMenu && (
                <div className="absolute right-0 top-8 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 w-44 z-10">
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => cameraInputRef.current?.click()}
                  >
                    📷 Take a photo
                  </button>
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    🖼️ Upload a photo
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}


      {/* Standalone voice pill button */}
      {voiceSupported && !preview && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleMicClick}
            aria-label={voiceState === "recording" ? "Listening, tap to stop" : "Speak your ingredients"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              voiceState === "recording"
                ? "bg-[#1A3A2A] text-white shadow-lg scale-105"
                : "bg-white border border-gray-200 text-gray-500 hover:border-[#D4622A] hover:text-[#D4622A] shadow-sm"
            }`}
          >
            {voiceState === "recording" ? (
              <span className="flex items-end gap-0.5 h-4" aria-hidden="false">
                {[0.6, 1.0, 0.8, 1.0, 0.6].map((h, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-white rounded-full animate-bounce"
                    style={{
                      height: `${h * 100}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: "0.7s",
                    }}
                  />
                ))}
              </span>
            ) : (
              <span className="text-base">🎤</span>
            )}
          </button>
        </div>
      )}
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
      />

      {/* Slot for content above the submit button (e.g. FiltersPanel) */}
      {beforeSubmit}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!hasInput || isLoading || disabled}
        className="w-full bg-[#D4622A] text-white font-semibold py-4 rounded-2xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#BF5525] transition-colors"
      >
        {isLoading ? "🍳 Finding recipes..." : "Find Recipes →"}
      </button>
    </div>
  );
}
