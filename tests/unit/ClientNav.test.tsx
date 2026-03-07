import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/searchHistory", () => ({
  loadHistory: vi.fn(() => []),
  deleteHistoryEntry: vi.fn(),
  updateHistoryEntry: vi.fn(),
}));

describe("ClientNav", () => {
  it("renders the Navbar with hamburger", () => {
    render(<ClientNav />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("opens sidebar when hamburger is clicked", () => {
    const { container } = render(<ClientNav />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(0)");
  });
});
