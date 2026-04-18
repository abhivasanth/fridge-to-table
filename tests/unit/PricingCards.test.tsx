import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PricingCards } from "@/components/PricingCards";

const mockState: {
  checkoutResult:
    | { ok: true; url: string }
    | {
        ok: false;
        reason: "already_subscribed" | "pending_cancel" | "past_due" | "no_user";
        redirectTo?: string;
      };
} = {
  checkoutResult: { ok: true, url: "https://checkout.stripe.com/test" },
};

const checkoutSpy = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: {
      id: "user_test",
      primaryEmailAddress: { emailAddress: "test@example.com" },
    },
    isLoaded: true,
  }),
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    stripe: { createCheckoutSession: "stripe:createCheckoutSession" },
  },
}));

vi.mock("convex/react", () => ({
  useAction: () => checkoutSpy,
}));

const locationHrefSetter = vi.fn();
Object.defineProperty(window, "location", {
  value: { href: "", assign: vi.fn() },
  writable: true,
});
Object.defineProperty(window.location, "href", {
  set: locationHrefSetter,
  get: () => "",
});

describe("PricingCards — single plan", () => {
  beforeEach(() => {
    mockState.checkoutResult = { ok: true, url: "https://checkout.stripe.com/test" };
    checkoutSpy.mockReset();
    checkoutSpy.mockImplementation(() => Promise.resolve(mockState.checkoutResult));
    locationHrefSetter.mockReset();
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID = "price_test";
  });

  it("shows a single plan card with $2.99/mo and a Subscribe button", () => {
    render(<PricingCards />);
    expect(screen.getByText("$2.99")).toBeInTheDocument();
    expect(screen.getByText(/\/mo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Subscribe/i })).toBeInTheDocument();
  });

  it("does NOT show trial, early-bird, or two-plan language", () => {
    render(<PricingCards />);
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/7-day/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/First 100/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Basic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Chef plan/i)).not.toBeInTheDocument();
  });

  it("clicking Subscribe redirects to Stripe checkout URL", async () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("https://checkout.stripe.com/test");
    });
  });

  it("calls createCheckoutSession with the configured price ID (no plan arg)", async () => {
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalledWith({
        clerkId: "user_test",
        email: "test@example.com",
        priceId: "price_test",
      });
    });
  });

  it("redirects to /settings if server returns already_subscribed", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "already_subscribed",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("redirects to /settings if server returns pending_cancel", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "pending_cancel",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("redirects to /settings if server returns past_due", async () => {
    mockState.checkoutResult = {
      ok: false,
      reason: "past_due",
      redirectTo: "/settings",
    };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    await waitFor(() => {
      expect(locationHrefSetter).toHaveBeenCalledWith("/settings");
    });
  });

  it("shows friendly error if server returns no_user", async () => {
    mockState.checkoutResult = { ok: false, reason: "no_user" };
    render(<PricingCards />);
    fireEvent.click(screen.getByRole("button", { name: /Subscribe/i }));
    expect(await screen.findByText(/We couldn't start checkout/)).toBeInTheDocument();
  });
});
