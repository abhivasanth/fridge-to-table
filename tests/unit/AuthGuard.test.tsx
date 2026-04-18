import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/AuthGuard";

type UseUserReturn = {
  user: { id: string } | null;
  isLoaded: boolean;
};

const mockState: { useUser: UseUserReturn } = {
  useUser: { user: null, isLoaded: false },
};

const pushSpy = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockState.useUser,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushSpy }),
}));

describe("AuthGuard", () => {
  beforeEach(() => {
    pushSpy.mockReset();
    mockState.useUser = { user: null, isLoaded: false };
  });

  it("renders loading state when Clerk hasn't loaded", () => {
    mockState.useUser = { user: null, isLoaded: false };
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("redirects to /sign-in when Clerk is loaded but there's no user", () => {
    mockState.useUser = { user: null, isLoaded: true };
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );
    expect(pushSpy).toHaveBeenCalledWith("/sign-in");
    // Still renders loading spinner until redirect completes
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
  });

  it("renders children when user is authenticated", () => {
    mockState.useUser = { user: { id: "user_test" }, isLoaded: true };
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );
    expect(screen.getByText("protected content")).toBeInTheDocument();
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it("does NOT redirect while Clerk is still loading (no flash to sign-in on fresh page load)", () => {
    mockState.useUser = { user: null, isLoaded: false };
    render(
      <AuthGuard>
        <div>protected content</div>
      </AuthGuard>
    );
    expect(pushSpy).not.toHaveBeenCalled();
  });
});
