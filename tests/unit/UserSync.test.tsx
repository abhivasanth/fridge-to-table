import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";

// Mock state that our vi.mock-hoisted factories can read.
type UseUserReturn = {
  user: {
    id: string;
    primaryEmailAddress: { emailAddress: string } | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  isLoaded: boolean;
};

const mockState: { useUser: UseUserReturn } = {
  useUser: { user: null, isLoaded: false },
};

const getOrCreateSpy = vi.fn().mockResolvedValue(undefined);

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ isSignedIn: false, isLoaded: true, getToken: async () => null }),
  useUser: () => mockState.useUser,
}));

vi.mock("convex/react-clerk", () => ({
  ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("convex/react", () => ({
  ConvexReactClient: vi.fn(),
  useMutation: () => getOrCreateSpy,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: { getOrCreateUser: "users:getOrCreateUser" },
  },
}));

describe("ConvexClientProvider (UserSync effect)", () => {
  beforeEach(() => {
    getOrCreateSpy.mockReset().mockResolvedValue(undefined);
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://test.convex.cloud";
  });

  it("does NOT call getOrCreateUser when Clerk hasn't loaded", () => {
    mockState.useUser = { user: null, isLoaded: false };
    render(
      <ConvexClientProvider>
        <div />
      </ConvexClientProvider>
    );
    expect(getOrCreateSpy).not.toHaveBeenCalled();
  });

  it("does NOT call getOrCreateUser when Clerk is loaded but no user", () => {
    mockState.useUser = { user: null, isLoaded: true };
    render(
      <ConvexClientProvider>
        <div />
      </ConvexClientProvider>
    );
    expect(getOrCreateSpy).not.toHaveBeenCalled();
  });

  it("calls getOrCreateUser with profile fields (NOT clerkId) when user signs in", async () => {
    mockState.useUser = {
      user: {
        id: "user_test",
        primaryEmailAddress: { emailAddress: "test@example.com" },
        firstName: "Test",
        lastName: "User",
      },
      isLoaded: true,
    };
    render(
      <ConvexClientProvider>
        <div />
      </ConvexClientProvider>
    );
    await waitFor(() => {
      expect(getOrCreateSpy).toHaveBeenCalledWith({
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
      });
    });
    // Critically: no clerkId passed — that's derived server-side from the JWT
    const callArg = getOrCreateSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty("clerkId");
  });

  it("handles missing email/firstName/lastName gracefully", async () => {
    mockState.useUser = {
      user: {
        id: "user_minimal",
        primaryEmailAddress: null,
        firstName: null,
        lastName: null,
      },
      isLoaded: true,
    };
    render(
      <ConvexClientProvider>
        <div />
      </ConvexClientProvider>
    );
    await waitFor(() => {
      expect(getOrCreateSpy).toHaveBeenCalledWith({
        email: "",
        firstName: undefined,
        lastName: undefined,
      });
    });
  });
});
