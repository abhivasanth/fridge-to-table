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

  it("logo link points to /", () => {
    render(<Navbar />);
    const logoLink = screen.getByRole("link", { name: /fridge to table/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("Favourites link points to /favourites", () => {
    render(<Navbar />);
    const favLink = screen.getByRole("link", { name: /favourites/i });
    expect(favLink).toHaveAttribute("href", "/favourites");
  });

  it("does not render a Home nav link", () => {
    render(<Navbar />);
    expect(screen.queryByRole("link", { name: /^home$/i })).not.toBeInTheDocument();
  });

  it("does not render a Try Free button", () => {
    render(<Navbar />);
    expect(screen.queryByText(/try free/i)).not.toBeInTheDocument();
  });
});
