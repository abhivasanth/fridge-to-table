"use client";
import { useState } from "react";
import { parseIngredients } from "@/lib/ingredientParser";
import { compressImage } from "@/lib/imageCompression";

type Props = {
  // Called when the user clicks "Find Recipes"
  // ingredients: parsed text list OR empty array (if photo mode — action will extract them)
  // imageBase64: only present when photo mode is used
  onSubmit: (ingredients: string[], imageBase64?: string) => void;
  isLoading: boolean;
};

// Handles both text input (comma-separated list) and photo upload.
export function IngredientInput({ onSubmit, isLoading }: Props) {
  const [activeTab, setActiveTab] = useState<"text" | "photo">("text");
  const [textInput, setTextInput] = useState("");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      // Compress before storing — keeps payload within Convex's 8MB limit
      const compressed = await compressImage(file, 1024);
      setPhotoBase64(compressed);
      setPhotoPreview(compressed);
    } catch {
      setPhotoError("Couldn't read that image — please try another.");
    }
  }

  function handleSubmit() {
    if (activeTab === "text") {
      const ingredients = parseIngredients(textInput);
      if (ingredients.length === 0) return;
      onSubmit(ingredients);
    } else {
      if (!photoBase64) return;
      // In photo mode, pass empty ingredients array — the analyzePhoto action extracts them
      onSubmit([], photoBase64);
    }
  }

  const canSubmit =
    !isLoading &&
    (activeTab === "text"
      ? parseIngredients(textInput).length > 0
      : photoBase64 !== null);

  return (
    <div className="w-full max-w-xl">
      {/* Tab toggle */}
      <div className="flex rounded-xl border border-gray-200 mb-4 overflow-hidden">
        {(["text", "photo"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${activeTab === tab
                ? "bg-green-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
          >
            {tab === "text" ? "Type ingredients" : "Upload photo"}
          </button>
        ))}
      </div>

      {/* Text input */}
      {activeTab === "text" && (
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="e.g. eggs, spinach, tomatoes, feta cheese..."
          rows={4}
          className="w-full rounded-xl border border-gray-200 p-4 text-gray-800
                     placeholder:text-gray-400 focus:outline-none focus:ring-2
                     focus:ring-green-500 resize-none"
        />
      )}

      {/* Photo upload */}
      {activeTab === "photo" && (
        <div>
          <label
            htmlFor="photo-upload"
            className="flex flex-col items-center justify-center w-full h-48
                       border-2 border-dashed border-gray-300 rounded-xl
                       cursor-pointer hover:border-green-400 hover:bg-green-50
                       transition-colors bg-gray-50 overflow-hidden"
          >
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoPreview}
                alt="Your fridge"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-4">
                <p className="text-4xl mb-2">📸</p>
                <p className="text-gray-500 text-sm">
                  Click or drag to upload your fridge photo
                </p>
              </div>
            )}
          </label>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photoError && (
            <p className="text-red-500 text-sm mt-2">{photoError}</p>
          )}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 w-full py-3 rounded-xl font-semibold text-white
                   bg-green-600 hover:bg-green-700 disabled:opacity-40
                   disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Finding recipes..." : "Find Recipes"}
      </button>
    </div>
  );
}
