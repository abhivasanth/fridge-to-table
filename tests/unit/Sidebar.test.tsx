import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import type { HistoryEntry } from "@/types/recipe";

const mockHistory: HistoryEntry[] = [
  { id: "1", query: "eggs, milk", timestamp: Date.now(), resultType: "recipes", recipeSetId: "abc" },
  { id: "2", query: "chicken steak", timestamp: Date.now() - 86400001, resultType: "chefs", videoResults: [], pinned: true },
];

vi.mock("@/lib/searchHistory", () => ({
  loadHistory: vi.fn(() => mockHistory),
  deleteHistoryEntry: vi.fn(),
  updateHistoryEntry: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

describe("Sidebar", () => {
  it("renders hidden when open is false", () => {
    const { container } = render(
      <Sidebar open={false} onClose={vi.fn()} isDesktop={false} />
    );
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(-100%)");
  });

  it("renders visible when open is true", () => {
    const { container } = render(
      <Sidebar open={true} onClose={vi.fn()} isDesktop={false} />
    );
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(0)");
  });

  it("renders search input and nav links for My Chefs, Favorites", () => {
    render(<Sidebar open={true} onClose={vi.fn()} isDesktop={false} />);
    expect(screen.getByPlaceholderText("Search past recipes...")).toBeInTheDocument();
    expect(screen.getByText("My Chefs")).toBeInTheDocument();
    expect(screen.getByText("Favorites")).toBeInTheDocument();
  });

  it("renders New Search button", () => {
    render(<Sidebar open={true} onClose={vi.fn()} isDesktop={false} />);
    expect(screen.getByText(/New Search/)).toBeInTheDocument();
  });

  it("renders pinned entries under PINNED section", () => {
    render(<Sidebar open={true} onClose={vi.fn()} isDesktop={false} />);
    expect(screen.getByText("PINNED")).toBeInTheDocument();
    expect(screen.getByText("chicken steak")).toBeInTheDocument();
  });

  it("renders recent entries under RECENT SEARCHES section", () => {
    render(<Sidebar open={true} onClose={vi.fn()} isDesktop={false} />);
    expect(screen.getByText("RECENT SEARCHES")).toBeInTheDocument();
    expect(screen.getByText("eggs, milk")).toBeInTheDocument();
  });

  it("calls onClose when backdrop is clicked (mobile)", () => {
    const onClose = vi.fn();
    render(<Sidebar open={true} onClose={onClose} isDesktop={false} />);
    fireEvent.click(screen.getByTestId("sidebar-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not render backdrop on desktop", () => {
    render(<Sidebar open={true} onClose={vi.fn()} isDesktop={true} />);
    expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
  });
});
