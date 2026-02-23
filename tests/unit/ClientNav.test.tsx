import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockUsePathname = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("ClientNav", () => {
  it("shows Navbar (brand name) on the home route", () => {
    mockUsePathname.mockReturnValue("/");
    render(<ClientNav />);
    expect(screen.getByText("Fridge to Table")).toBeInTheDocument();
  });

  it("shows BottomNav (Saved tab) on non-home routes", () => {
    mockUsePathname.mockReturnValue("/favourites");
    render(<ClientNav />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
