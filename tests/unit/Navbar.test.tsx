import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Navbar", () => {
  it("renders the brand logo", () => {
    render(<Navbar />);
    expect(screen.getByLabelText("fridge to table")).toBeInTheDocument();
  });

  it("logo link points to /", () => {
    render(<Navbar />);
    const logoLink = screen.getByRole("link", { name: /fridge to table/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("does not render My Chefs or Favorites nav links", () => {
    render(<Navbar />);
    expect(screen.queryByText("My Chefs")).not.toBeInTheDocument();
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  });
});
