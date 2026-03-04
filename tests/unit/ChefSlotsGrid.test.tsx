import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChefSlotsGrid } from "@/components/v3/ChefSlotsGrid";
import type { ChefSlot } from "@/types/v3";

const defaultSlots: ChefSlot[] = [
  { type: "preset", chefId: "gordon-ramsay" },
  { type: "preset", chefId: "jamie-oliver" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
  { type: "empty" },
];

describe("ChefSlotsGrid", () => {
  it("renders 6 slots", () => {
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={vi.fn()} onSelectionChange={vi.fn()} />);
    expect(screen.getByText("Gordon Ramsay")).toBeInTheDocument();
    expect(screen.getByText("Jamie Oliver")).toBeInTheDocument();
    expect(screen.getAllByText("+ Add chef")).toHaveLength(4);
  });

  it("shows slot count as 2/6 with 2 preset slots", () => {
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={vi.fn()} onSelectionChange={vi.fn()} />);
    expect(screen.getByText("2/6 slots")).toBeInTheDocument();
  });

  it("calls onSelectionChange when preset slot is tapped", () => {
    const onSelectionChange = vi.fn();
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={vi.fn()} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay").closest("button")!);
    expect(onSelectionChange).toHaveBeenCalledWith([0]);
  });

  it("deselects when a selected slot is tapped again", () => {
    const onSelectionChange = vi.fn();
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[0]} onSlotsChange={vi.fn()} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByText("Gordon Ramsay").closest("button")!);
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("clicking an empty slot shows the URL input", () => {
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={vi.fn()} onSelectionChange={vi.fn()} />);
    fireEvent.click(screen.getAllByText("+ Add chef")[0]);
    expect(screen.getByPlaceholderText("YouTube URL")).toBeInTheDocument();
  });

  it("submitting a valid URL calls onResolveChannel and onSlotsChange", async () => {
    const onResolveChannel = vi.fn().mockResolvedValue({ channelId: "UC123", channelName: "Test Chef" });
    const onSlotsChange = vi.fn();
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={onSlotsChange} onSelectionChange={vi.fn()} onResolveChannel={onResolveChannel} />);
    fireEvent.click(screen.getAllByText("+ Add chef")[0]);
    fireEvent.change(screen.getByPlaceholderText("YouTube URL"), { target: { value: "https://youtube.com/@test" } });
    fireEvent.click(screen.getByText("Add"));
    await vi.waitFor(() => expect(onSlotsChange).toHaveBeenCalled());
    const newSlots = onSlotsChange.mock.calls[0][0];
    expect(newSlots[2]).toEqual({ type: "custom", channelId: "UC123", channelName: "Test Chef" });
  });

  it("shows error when onResolveChannel returns null", async () => {
    const onResolveChannel = vi.fn().mockResolvedValue(null);
    render(<ChefSlotsGrid slots={defaultSlots} selectedIndices={[]} onSlotsChange={vi.fn()} onSelectionChange={vi.fn()} onResolveChannel={onResolveChannel} />);
    fireEvent.click(screen.getAllByText("+ Add chef")[0]);
    fireEvent.change(screen.getByPlaceholderText("YouTube URL"), { target: { value: "https://youtube.com/@bad" } });
    fireEvent.click(screen.getByText("Add"));
    await vi.waitFor(() => expect(screen.getByText("Channel not found. Check the URL.")).toBeInTheDocument());
  });
});
