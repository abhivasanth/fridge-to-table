"use client";
import { useState } from "react";
import { CHEFS } from "@/lib/chefs";
import type { ChefSlot } from "@/types/v3";

type Props = {
  slots: ChefSlot[];
  selectedIndices: number[];
  onSlotsChange: (slots: ChefSlot[]) => void;
  onSelectionChange: (indices: number[]) => void;
  onResolveChannel?: (url: string) => Promise<{ channelId: string; channelName: string } | null>;
};

export function ChefSlotsGrid({ slots, selectedIndices, onSlotsChange, onSelectionChange, onResolveChannel }: Props) {
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  const [addingUrl, setAddingUrl] = useState("");
  const [addingError, setAddingError] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  const filledCount = slots.filter((s) => s.type !== "empty").length;

  function toggleSelection(index: number) {
    if (slots[index].type === "empty") return;
    if (selectedIndices.includes(index)) {
      onSelectionChange(selectedIndices.filter((i) => i !== index));
    } else {
      onSelectionChange([...selectedIndices, index]);
    }
  }

  function removeChef(index: number) {
    const updated = [...slots];
    updated[index] = { type: "empty" };
    onSlotsChange(updated);
    onSelectionChange(selectedIndices.filter((i) => i !== index));
  }

  async function handleAddChef(index: number) {
    if (!addingUrl.trim() || !onResolveChannel) return;
    setAddingLoading(true);
    setAddingError("");
    try {
      const result = await onResolveChannel(addingUrl.trim());
      if (!result) {
        setAddingError("Channel not found. Check the URL.");
        return;
      }
      const updated = [...slots];
      updated[index] = { type: "custom", channelId: result.channelId, channelName: result.channelName };
      onSlotsChange(updated);
      setAddingIndex(null);
      setAddingUrl("");
    } catch {
      setAddingError("Something went wrong. Please try again.");
    } finally {
      setAddingLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[#1A3A2A]">Your Chefs</span>
        <span className="text-xs text-gray-400">{filledCount}/6 slots</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot, index) => {
          const isSelected = selectedIndices.includes(index);

          if (slot.type === "empty") {
            if (addingIndex === index) {
              return (
                <div key={index} className="rounded-xl border border-[#D4622A] p-2 flex flex-col gap-1.5 bg-white">
                  <input
                    autoFocus
                    value={addingUrl}
                    onChange={(e) => { setAddingUrl(e.target.value); setAddingError(""); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && !addingLoading) handleAddChef(index); if (e.key === "Escape") { setAddingIndex(null); setAddingUrl(""); setAddingError(""); } }}
                    placeholder="YouTube URL"
                    aria-label="YouTube channel URL"
                    style={{ fontSize: "11px", border: "none", outline: "none", color: "#1A3A2A", background: "transparent", width: "100%" }}
                  />
                  {addingError && <p style={{ fontSize: "10px", color: "#D4622A" }}>{addingError}</p>}
                  <button
                    type="button"
                    onClick={() => handleAddChef(index)}
                    disabled={addingLoading}
                    style={{ fontSize: "10px", color: "white", background: "#C4622A", border: "none", borderRadius: "6px", padding: "3px 8px", cursor: "pointer" }}
                  >
                    {addingLoading ? "..." : "Add"}
                  </button>
                </div>
              );
            }
            return (
              <button
                key={index}
                type="button"
                onClick={() => { setAddingIndex(index); setAddingUrl(""); setAddingError(""); }}
                style={{
                  border: "1.5px dashed #E8E0D8", borderRadius: "10px",
                  padding: "10px 8px", display: "flex", alignItems: "center",
                  justifyContent: "center", background: "transparent",
                  cursor: "pointer", minHeight: "52px",
                }}
              >
                <span style={{ fontSize: "11px", color: "#bbb" }}>+ Add chef</span>
              </button>
            );
          }

          // Filled slot (preset or custom)
          const name = slot.type === "preset"
            ? (CHEFS.find((c) => c.id === slot.chefId)?.name ?? slot.chefId)
            : slot.channelName;
          const emoji = slot.type === "preset"
            ? (CHEFS.find((c) => c.id === slot.chefId)?.emoji ?? "👨‍🍳")
            : "📺";

          return (
            <div key={index} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => toggleSelection(index)}
                style={{
                  width: "100%",
                  border: isSelected ? "2px solid #D4622A" : "1.5px solid #E8E0D8",
                  borderRadius: "10px",
                  padding: "8px",
                  display: "flex", alignItems: "center", gap: "6px",
                  background: isSelected ? "rgba(212, 96, 44, 0.05)" : "white",
                  cursor: "pointer",
                  opacity: isSelected ? 1 : 0.55,
                  filter: isSelected ? "none" : "grayscale(80%)",
                  transition: "all 0.15s ease",
                  minHeight: "52px",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: "20px", flexShrink: 0 }}>{emoji}</span>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#1A3A2A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {name}
                </span>
              </button>
              {isSelected && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeChef(index); }}
                  aria-label={`Remove ${name}`}
                  style={{
                    position: "absolute", top: "4px", right: "4px",
                    width: "18px", height: "18px", borderRadius: "50%",
                    background: "#D4622A", border: "none", color: "white",
                    fontSize: "10px", cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center", lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
