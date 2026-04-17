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
  initialText?: string;
  showPhotoButton?: boolean;
  isSignedIn?: boolean;
  ctaHref?: string;
  ctaText?: string;
};

export function IngredientInput({ onSubmit, isLoading, disabled, beforeSubmit, initialText, showPhotoButton, isSignedIn, ctaHref, ctaText }: Props) {
  const [text, setText] = useState(initialText ?? "");
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "recording">("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const recognitionRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);

  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimText, setInterimText] = useState("");
  const committedTextRef = useRef(""); // finalized dictation text
  const manualStopRef = useRef(false);  // true when user tapped mic to stop
  useEffect(() => {
    setVoiceSupported(isVoiceSupported());
  }, []);

  // Sync text when initialText prop changes after mount (e.g. restored from sessionStorage)
  useEffect(() => {
    if (initialText !== undefined) {
      setText(initialText);
    }
  }, [initialText]);

  const ingredients = parseIngredients(text);
  const hasInput = ingredients.length > 0 || preview !== null;

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

  function startRecognition() {
    const recognition = createSpeechRecognition();
    if (!recognition) return;
    recognition.interimResults = true;
    // continuous: false — each phrase is its own session, preventing browser audio replay duplication
    recognitionRef.current = recognition;

    recognition.onstart = () => setVoiceState("recording");
    recognition.onresult = (e: any) => {
      let interim = "";
      let finalTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          finalTranscript += e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        const base = committedTextRef.current;
        const updated = base ? base + " " + finalTranscript : finalTranscript;
        committedTextRef.current = updated;
        setText(updated);
      }
      setInterimText(interim);
    };
    recognition.onend = () => {
      setInterimText("");
      if (!manualStopRef.current) {
        // Brief pause before restarting so browser fully flushes the previous session
        setTimeout(() => {
          if (!manualStopRef.current) {
            try { startRecognition(); } catch { setVoiceState("idle"); }
          }
        }, 150);
      } else {
        setVoiceState("idle");
      }
    };
    recognition.onerror = (e: any) => {
      // "no-speech" is harmless — onend will fire and restart
      if (e.error !== "no-speech") {
        manualStopRef.current = true;
        setVoiceState("idle");
        setInterimText("");
      }
    };
    recognition.start();
  }

  function handleMicClick() {
    if (voiceState === "recording") {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      return;
    }
    manualStopRef.current = false;
    committedTextRef.current = text;
    startRecognition();
  }

  function handleSubmit() {
    if (preview) {
      onSubmit([], preview);
    } else {
      onSubmit(ingredients);
    }
  }

  const wrapperStyle: React.CSSProperties = {
    border: focused ? "1.5px solid #D4845A" : "1.5px solid #e5e7eb",
    borderRadius: "14px",
    boxShadow: focused ? "0 0 0 3px rgba(196, 98, 42, 0.08)" : "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    background: "white",
  };

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

      {/* Input row: + left | textarea | mic right */}
      {!preview && (
        <div className="flex items-start" style={wrapperStyle}>
          {/* + button — left side */}
          {showPhotoButton !== false && (
          <div className="relative flex-shrink-0" ref={photoMenuRef} style={{ margin: "10px 0 10px 10px" }}>
            <button
              type="button"
              onClick={() => setShowPhotoMenu((v) => !v)}
              aria-label="Add photo"
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "#FAF7F2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "20px",
                lineHeight: 1,
                border: "none",
                cursor: "pointer",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#f0ebe3";
                (e.currentTarget as HTMLButtonElement).style.color = "#6b7280";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = "#FAF7F2";
                (e.currentTarget as HTMLButtonElement).style.color = "#9ca3af";
              }}
            >
              +
            </button>
            {showPhotoMenu && (
              <div className="absolute left-0 top-12 bg-white rounded-2xl shadow-lg border border-gray-100 py-2 w-44 z-10">
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
          )}

          {/* Textarea — middle */}
          <textarea
            value={
              voiceState === "recording" && interimText
                ? (committedTextRef.current ? committedTextRef.current + " " + interimText : interimText)
                : text
            }
            onChange={(e) => { if (voiceState !== "recording") setText(e.target.value); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Type your ingredients, e.g. eggs, spinach, tomatoes..."
            style={{
              flex: 1,
              padding: "16px 14px 16px 12px",
              border: "none",
              background: "transparent",
              resize: "none",
              outline: "none",
              fontSize: "14px",
              color: "#1f2937",
              minHeight: "60px",
            }}
            rows={2}
          />

          {/* Mic button — right side */}
          {voiceSupported && (
            <div style={{ margin: "14px 12px 14px 0", flexShrink: 0 }}>
              <button
                type="button"
                onClick={handleMicClick}
                aria-label={voiceState === "recording" ? "Dictating, tap to stop" : "Dictate your ingredients"}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: voiceState === "recording" ? "#1A3A2A" : "transparent",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (voiceState !== "recording")
                    (e.currentTarget as HTMLButtonElement).style.background = "#FAF7F2";
                }}
                onMouseLeave={(e) => {
                  if (voiceState !== "recording")
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                {voiceState === "recording" ? (
                  <span className="flex items-end gap-px h-3" aria-hidden="false">
                    {[0.6, 1.0, 0.8, 1.0, 0.6].map((h, i) => (
                      <span
                        key={i}
                        className="w-px bg-white rounded-full animate-bounce"
                        style={{
                          height: `${h * 100}%`,
                          animationDelay: `${i * 0.1}s`,
                          animationDuration: "0.7s",
                        }}
                      />
                    ))}
                  </span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3"/>
                    <path d="M5 10a7 7 0 0 0 14 0"/>
                    <line x1="12" y1="19" x2="12" y2="22"/>
                    <line x1="9" y1="22" x2="15" y2="22"/>
                  </svg>
                )}
              </button>
            </div>
          )}
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
      {isSignedIn === false ? (
        <a
          href={ctaHref ?? "/sign-up"}
          className="w-full block text-center bg-[#D4622A] text-white py-4 rounded-2xl font-bold text-base hover:bg-[#BF5525] transition-colors"
        >
          {ctaText ?? "Sign Up to Start"}
        </a>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={!hasInput || isLoading || disabled}
          className="btn-find-recipes w-full text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: "#C4622A",
            borderRadius: "14px",
            padding: "16px 24px",
            fontSize: "15px",
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.background = "#B5551F";
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(196, 98, 42, 0.3)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#C4622A";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          {isLoading ? "🍳 Finding recipes..." : "Find Recipes →"}
        </button>
      )}
    </div>
  );
}
