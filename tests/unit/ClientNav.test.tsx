import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("ClientNav", () => {
  it("shows Navbar on all routes", () => {
    render(<ClientNav />);
    expect(screen.getByLabelText("fridge to table")).toBeInTheDocument();
  });

  it("shows Favorites link", () => {
    render(<ClientNav />);
    expect(screen.getByRole("link", { name: /favorites/i })).toBeInTheDocument();
  });
});
