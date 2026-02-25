import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { IngredientInput } from "@/components/IngredientInput";

const mockRecognition = {
  start: vi.fn(),
  stop: vi.fn(),
  onstart: null as any,
  onresult: null as any,
  onend: null as any,
  onerror: null as any,
};

vi.mock("@/lib/voiceInput", () => ({
  isVoiceSupported: () => true,
  createSpeechRecognition: () => mockRecognition,
}));

describe("IngredientInput — voice button", () => {
  it("shows Dictate button when voice is supported", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole("button", { name: /dictate your ingredients/i })).toBeInTheDocument();
  });

  it("does not show the old inline mic emoji button", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.queryByLabelText("Start voice input")).not.toBeInTheDocument();
  });

  it("shows Listening text when recording starts", () => {
    render(<IngredientInput onSubmit={vi.fn()} isLoading={false} />);
    const dictateBtn = screen.getByRole("button", { name: /dictate your ingredients/i });
    fireEvent.click(dictateBtn);
    // Simulate recognition.onstart firing
    act(() => {
      mockRecognition.onstart?.();
    });
    expect(screen.getByRole("button", { name: /dictating.*tap to stop/i })).toBeInTheDocument();
  });
});
