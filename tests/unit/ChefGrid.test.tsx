import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefGrid } from "@/components/ChefGrid";
import type { ChefSlot } from "@/lib/chefs";

const mockChefs: ChefSlot[] = [
  { id: "gordon-ramsay", name: "Gordon Ramsay", youtubeChannelId: "UCIEv3lZ_tNXHzL3ox-_uUGQ", isDefault: true, emoji: "🍳", country: "UK" },
  { id: "maangchi", name: "Maangchi", youtubeChannelId: "UC8gFadPgK2r1ndqLI04Xvvw", isDefault: true, emoji: "🥘", country: "South Korea" },
  { id: "pati-jinich", name: "Pati Jinich", youtubeChannelId: "UCgQJsIQB2gMYxSEIMomj0gg", isDefault: true, emoji: "🌮", country: "Mexico" },
];

describe("ChefGrid", () => {
  it("renders all chefs passed via props", () => {
    render(<ChefGrid chefs={mockChefs} selectedIds={[]} onChange={() => {}} />);
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("Maangchi")).toBeInTheDocument();
    expect(screen.getByText("Pati Jinich")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("calls onChange with added chef ID when clicking unselected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid chefs={mockChefs} selectedIds={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith(["gordon-ramsay"]);
  });

  it("calls onChange with chef removed when clicking selected chef", () => {
    const onChange = vi.fn();
    render(<ChefGrid chefs={mockChefs} selectedIds={["gordon-ramsay"]} onChange={onChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("shows selected count", () => {
    render(<ChefGrid chefs={mockChefs} selectedIds={["gordon-ramsay", "maangchi"]} onChange={() => {}} />);
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });
});
