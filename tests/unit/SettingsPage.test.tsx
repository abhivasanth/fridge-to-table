import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";

type DbUser = {
  _id: string;
  clerkId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  subscriptionStatus: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: number;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
};

// Hoisted vars so mocks can see them after they're assigned in beforeEach
const mockState = { user: null as DbUser | null };
const cancelSpy = vi.fn().mockResolvedValue({ ok: true });
const resumeSpy = vi.fn().mockResolvedValue({ ok: true });

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
      firstName: "Test",
      lastName: "User",
    },
    isLoaded: true,
  }),
  UserButton: () => null,
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getByClerkId: "users:getByClerkId",
    },
    stripe: {
      createPortalSession: "stripe:createPortalSession",
      cancelSubscription: "stripe:cancelSubscription",
      resumeSubscription: "stripe:resumeSubscription",
    },
  },
}));

vi.mock("convex/react", () => ({
  useQuery: () => mockState.user,
  useAction: (name: string) => {
    if (name === "stripe:cancelSubscription") return cancelSpy;
    if (name === "stripe:resumeSubscription") return resumeSpy;
    return vi.fn();
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/settings",
}));

vi.mock("@/components/PricingCards", () => ({
  PricingCards: () => <div data-testid="pricing-cards" />,
}));

const PERIOD_END = new Date("2026-05-18T06:00:45.000Z").getTime();

function baseUser(overrides: Partial<DbUser> = {}): DbUser {
  return {
    _id: "k1",
    clerkId: "user_test",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    subscriptionStatus: "active",
    cancelAtPeriodEnd: false,
    currentPeriodEnd: PERIOD_END,
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    ...overrides,
  };
}

describe("SettingsPage subscription states", () => {
  beforeEach(() => {
    cancelSpy.mockReset().mockResolvedValue({ ok: true });
    resumeSpy.mockReset().mockResolvedValue({ ok: true });
  });

  describe("Page structure", () => {
    it("heading reads 'Subscription' (not 'Account')", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Subscription" })
      ).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 1, name: "Account" })).not.toBeInTheDocument();
    });

    it("does NOT render a Profile section (managed via Clerk modal)", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      expect(screen.queryByText(/First name/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Last name/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Save changes/i })).not.toBeInTheDocument();
    });
  });

  describe("Active (no pending cancel)", () => {
    it("shows Active status label", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("shows Cancel subscription button, not Resume", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /Cancel subscription/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Resume subscription/ })).not.toBeInTheDocument();
    });

    it("shows Next charge row with $2.99", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      expect(screen.getByText("Next charge")).toBeInTheDocument();
      expect(screen.getByText(/\$2\.99 on/)).toBeInTheDocument();
    });

    it("cancel confirmation shows paid-variant copy", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      expect(screen.getByText(/Cancel your subscription\?/)).toBeInTheDocument();
      expect(screen.getByText(/You won't be charged again/)).toBeInTheDocument();
    });

    it("does NOT show any 'free trial' language", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    });
  });

  describe("Active + pending cancel", () => {
    const pendingActive = () =>
      baseUser({ subscriptionStatus: "active", cancelAtPeriodEnd: true });

    it("shows 'Cancelled — access until X' status label", () => {
      mockState.user = pendingActive();
      render(<SettingsPage />);
      expect(screen.getByText(/Cancelled — access until/)).toBeInTheDocument();
    });

    it("shows Resume subscription button, hides Cancel", () => {
      mockState.user = pendingActive();
      render(<SettingsPage />);
      expect(screen.getByRole("button", { name: /Resume subscription/ })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancel subscription/ })).not.toBeInTheDocument();
    });

    it("hides Next charge row (not billing anymore)", () => {
      mockState.user = pendingActive();
      render(<SettingsPage />);
      expect(screen.queryByText("Next charge")).not.toBeInTheDocument();
    });

    it("clicking Resume invokes the resumeSubscription action", async () => {
      mockState.user = pendingActive();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Resume subscription/ }));
      await waitFor(() => {
        expect(resumeSpy).toHaveBeenCalledWith({ stripeSubscriptionId: "sub_123" });
      });
    });

    it("clicking Resume optimistically flips UI back to Cancel affordance", async () => {
      mockState.user = pendingActive();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Resume subscription/ }));
      // After the action resolves, UI should show Cancel again (optimistic override)
      // even though dbUser.cancelAtPeriodEnd hasn't changed yet
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Cancel subscription/ })).toBeInTheDocument();
      });
    });
  });

  describe("Cancelled (truly expired) — plan picker for returning user", () => {
    it("shows 'Welcome back' copy + plan picker, not management UI", () => {
      mockState.user = baseUser({
        subscriptionStatus: "cancelled",
        cancelAtPeriodEnd: false,
      });
      render(<SettingsPage />);
      expect(screen.getByText(/Welcome back/)).toBeInTheDocument();
      expect(screen.getByTestId("pricing-cards")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancel subscription/ })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Resume subscription/ })).not.toBeInTheDocument();
    });
  });

  describe("No subscription yet (fresh user) — plan picker", () => {
    it("shows 'Choose a plan' copy + plan picker", () => {
      mockState.user = baseUser({
        subscriptionStatus: "none",
        stripeSubscriptionId: undefined,
        cancelAtPeriodEnd: false,
      });
      render(<SettingsPage />);
      expect(screen.getByText(/Choose a plan/)).toBeInTheDocument();
      expect(screen.getByTestId("pricing-cards")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancel subscription/ })).not.toBeInTheDocument();
    });
  });

  describe("Past due — update payment required", () => {
    it("shows payment-failed banner + Update payment button", () => {
      mockState.user = baseUser({
        subscriptionStatus: "past_due",
        cancelAtPeriodEnd: false,
      });
      render(<SettingsPage />);
      expect(screen.getByText(/Your payment didn't go through/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Update payment method/ })).toBeInTheDocument();
      expect(screen.queryByTestId("pricing-cards")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Cancel subscription/ })).not.toBeInTheDocument();
    });
  });

  describe("Cancel flow", () => {
    it("clicking 'Yes, cancel' calls cancelSubscription with the sub ID", async () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
      await waitFor(() => {
        expect(cancelSpy).toHaveBeenCalledWith({ stripeSubscriptionId: "sub_123" });
      });
    });

    it("after successful cancel, UI optimistically shows Resume button", async () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /Resume subscription/ })).toBeInTheDocument();
      });
    });

    it("'Keep my subscription' returns to settings without cancelling", () => {
      mockState.user = baseUser();
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      fireEvent.click(screen.getByRole("button", { name: /Keep my subscription/ }));
      expect(cancelSpy).not.toHaveBeenCalled();
      expect(screen.queryByText(/Cancel your subscription\?/)).not.toBeInTheDocument();
    });
  });

  describe("Stripe error handling", () => {
    it("shows 'already ended' message when cancel targets a dead subscription", async () => {
      mockState.user = baseUser();
      cancelSpy.mockResolvedValueOnce({ ok: false, reason: "already_ended" });
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
      expect(await screen.findByText(/Your subscription has already ended/)).toBeInTheDocument();
    });

    it("shows generic error when cancel fails for unknown reason", async () => {
      mockState.user = baseUser();
      cancelSpy.mockResolvedValueOnce({ ok: false, reason: "unknown" });
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Cancel subscription/ }));
      fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
      expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    });

    it("shows 'already ended' message when resume targets a dead subscription", async () => {
      mockState.user = baseUser({ cancelAtPeriodEnd: true });
      resumeSpy.mockResolvedValueOnce({ ok: false, reason: "already_ended" });
      render(<SettingsPage />);
      fireEvent.click(screen.getByRole("button", { name: /Resume subscription/ }));
      expect(await screen.findByText(/Your subscription has already ended/)).toBeInTheDocument();
    });
  });
});
