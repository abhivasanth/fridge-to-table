import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientNav } from "@/components/ClientNav";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: null,
    isLoaded: true,
  }),
  UserButton: () => null,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
  SignedIn: () => null,
  SignedOut: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
  it("renders the sidebar toggle button", () => {
    render(<ClientNav><div>content</div></ClientNav>);
    expect(screen.getByLabelText("Open sidebar")).toBeInTheDocument();
  });

  it("opens sidebar when toggle is clicked", () => {
    const { container } = render(<ClientNav><div>content</div></ClientNav>);
    fireEvent.click(screen.getByLabelText("Open sidebar"));
    const panel = container.querySelector('[data-testid="sidebar-panel"]');
    expect(panel).toHaveStyle("transform: translateX(0)");
  });

  it("renders children", () => {
    render(<ClientNav><div>test content</div></ClientNav>);
    expect(screen.getByText("test content")).toBeInTheDocument();
  });

  it("shows exactly one auth CTA (pointing at /sign-in) when signed out", () => {
    // Guards against future refactors silently reintroducing a second CTA or
    // dropping the sign-in link entirely. The label is deliberately part of
    // the assertion so renaming "Log in" is a deliberate edit, not an accident.
    render(<ClientNav><div /></ClientNav>);
    const signInLink = screen.getByRole("link", { name: /log in/i });
    expect(signInLink).toHaveAttribute("href", "/sign-in");
    expect(screen.queryAllByRole("link").filter(
      (a) => a.getAttribute("href") === "/sign-in" || a.getAttribute("href") === "/sign-up"
    )).toHaveLength(1);
  });
});
