import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Navbar", () => {
  it("renders the brand name", () => {
    render(<Navbar />);
    expect(screen.getByText("Fridge to Table")).toBeInTheDocument();
  });

  it("Home link points to /", () => {
    render(<Navbar />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("Favourites link points to /favourites", () => {
    render(<Navbar />);
    const favLink = screen.getByRole("link", { name: /favourites/i });
    expect(favLink).toHaveAttribute("href", "/favourites");
  });

  it("renders a Try Free call-to-action", () => {
    render(<Navbar />);
    expect(screen.getByText(/try free/i)).toBeInTheDocument();
  });
});
