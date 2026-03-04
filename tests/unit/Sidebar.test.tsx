import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/v3/Sidebar";
import type { HistoryEntry } from "@/types/v3";

const mockHistory: HistoryEntry[] = [
  { id: "1", query: "eggs, milk", timestamp: Date.now(), resultType: "recipes", recipeSetId: "abc" },
  { id: "2", query: "chicken steak", timestamp: Date.now() - 86400001, resultType: "chefs", videoResults: [] },
];

vi.mock("@/lib/searchHistory", () => ({
  loadHistory: vi.fn(() => mockHistory),
}));

describe("Sidebar", () => {
  it("renders hidden when open is false", () => {
    const { container } = render(
      <Sidebar open={false} onClose={vi.fn()} onNewSearch={vi.fn()} onSelectHistory={vi.fn()} />
    );
    const panel = container.querySelector('[style*="translateX(-100%)"]');
    expect(panel).toBeInTheDocument();
  });

  it("loads and renders history entries when opened", () => {
    render(<Sidebar open={true} onClose={vi.fn()} onNewSearch={vi.fn()} onSelectHistory={vi.fn()} />);
    expect(screen.getByText("eggs, milk")).toBeInTheDocument();
    expect(screen.getByText("chicken steak")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Sidebar open={true} onClose={onClose} onNewSearch={vi.fn()} onSelectHistory={vi.fn()} />
    );
    fireEvent.click(screen.getByTestId("backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onSelectHistory when a history entry is clicked", () => {
    const onSelectHistory = vi.fn();
    render(<Sidebar open={true} onClose={vi.fn()} onNewSearch={vi.fn()} onSelectHistory={onSelectHistory} />);
    fireEvent.click(screen.getByText("eggs, milk"));
    expect(onSelectHistory).toHaveBeenCalledWith(mockHistory[0]);
  });
});
