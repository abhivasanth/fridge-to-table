import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("Navbar", () => {
  it("renders the brand logo", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.getByLabelText("fridge to table")).toBeInTheDocument();
  });

  it("logo link points to /", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    const logoLink = screen.getByRole("link", { name: /fridge to table/i });
    expect(logoLink).toHaveAttribute("href", "/");
  });

  it("renders hamburger menu button", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("calls onMenuClick when hamburger is clicked", () => {
    const onMenuClick = vi.fn();
    render(<Navbar onMenuClick={onMenuClick} />);
    fireEvent.click(screen.getByLabelText("Open menu"));
    expect(onMenuClick).toHaveBeenCalled();
  });

  it("does not render My Chefs or Favorites nav links", () => {
    render(<Navbar onMenuClick={vi.fn()} />);
    expect(screen.queryByText("My Chefs")).not.toBeInTheDocument();
    expect(screen.queryByText("Favorites")).not.toBeInTheDocument();
  });
});
