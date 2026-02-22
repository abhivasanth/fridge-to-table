import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BottomNav } from "@/components/BottomNav";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("BottomNav", () => {
  it("renders Home and Saved links", () => {
    render(<BottomNav />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("Home links to /", () => {
    render(<BottomNav />);
    const homeLink = screen.getByText("Home").closest("a");
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("Saved links to /favourites", () => {
    render(<BottomNav />);
    const savedLink = screen.getByText("Saved").closest("a");
    expect(savedLink).toHaveAttribute("href", "/favourites");
  });
});
