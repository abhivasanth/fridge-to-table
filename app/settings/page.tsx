"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PricingCards } from "@/components/PricingCards";
import type { Doc } from "@/convex/_generated/dataModel";
import Link from "next/link";

type DbUser = Doc<"users">;

export default function SettingsPage() {
  const { user, isLoaded: clerkLoaded } = useUser();
  const router = useRouter();
  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );

  if (!clerkLoaded || (user && dbUser === undefined)) {
    return <LoadingScreen />;
  }

  if (!user) {
    router.push("/sign-in");
    return null;
  }

  if (!dbUser) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Setting up your account...</p>
      </main>
    );
  }

  const isActive =
    dbUser.subscriptionStatus === "trialing" ||
    dbUser.subscriptionStatus === "active";
  const isPastDue = dbUser.subscriptionStatus === "past_due";

  if (isPastDue) return <PastDueView dbUser={dbUser} />;
  if (isActive) return <ManageView dbUser={dbUser} />;
  return <PlanPickerView dbUser={dbUser} />;
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
      <p className="text-gray-400 animate-pulse">Loading...</p>
    </main>
  );
}

/* --- View: Plan picker (no active sub) --- */

function PlanPickerView({ dbUser }: { dbUser: DbUser }) {
  const isReturning = dbUser.subscriptionStatus === "cancelled";
  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
        >
          ← Back to search
        </Link>

        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-2">Subscription</h1>

        <div className="mb-8">
          {isReturning ? (
            <p className="text-gray-500">
              Welcome back. Your previous subscription has ended — pick a plan to
              resume cooking.
            </p>
          ) : (
            <p className="text-gray-500">
              Choose a plan to start cooking with Fridge to Table.
            </p>
          )}
        </div>

        <PricingCards />
      </div>
    </main>
  );
}

/* --- View: Past due (payment failed) --- */

function PastDueView({ dbUser }: { dbUser: DbUser }) {
  const createPortal = useAction(api.stripe.createPortalSession);
  const [opening, setOpening] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  async function handleUpdatePayment() {
    if (!dbUser.stripeCustomerId) return;
    setPortalError(null);
    setOpening(true);
    try {
      const result = await createPortal({
        stripeCustomerId: dbUser.stripeCustomerId,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        setPortalError("Couldn't open the billing portal. Please try again.");
      }
    } catch {
      setPortalError("Couldn't open the billing portal. Please try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
        >
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-6">Subscription</h1>

        <section className="bg-[#FFF4E6] border border-[#F6C67F] rounded-2xl p-6">
          <h2 className="text-base font-bold text-[#8A4D00] mb-2">
            Your payment didn&apos;t go through
          </h2>
          <p className="text-sm text-[#8A4D00] mb-4">
            We couldn&apos;t charge your card. Update your payment method to
            keep access.
          </p>
          <button
            onClick={handleUpdatePayment}
            disabled={opening || !dbUser.stripeCustomerId}
            className="bg-[#D4622A] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#BF5525] transition-colors disabled:opacity-50"
          >
            {opening ? "Opening..." : "Update payment method"}
          </button>
          {portalError && (
            <p className="text-sm text-red-600 mt-3">{portalError}</p>
          )}
        </section>
      </div>
    </main>
  );
}

/* --- View: Active/trialing management --- */

function ManageView({ dbUser }: { dbUser: DbUser }) {
  const createPortal = useAction(api.stripe.createPortalSession);
  const cancelSub = useAction(api.stripe.cancelSubscription);
  const resumeSub = useAction(api.stripe.resumeSubscription);

  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [portalOpening, setPortalOpening] = useState(false);
  // Errors are scoped to the action that produced them so messages render
  // adjacent to the button the user clicked, not in a shared slot.
  const [portalError, setPortalError] = useState<string | null>(null);
  const [subActionError, setSubActionError] = useState<string | null>(null);
  // Optimistic override — flips immediately so the UI reflects the user's
  // intent while we wait for the Stripe webhook to reach Convex.
  const [pendingCancelOverride, setPendingCancelOverride] = useState<
    boolean | null
  >(null);

  const actualPendingCancel = dbUser.cancelAtPeriodEnd === true;

  // Clear the override once the webhook-driven truth catches up.
  useEffect(() => {
    if (
      pendingCancelOverride !== null &&
      pendingCancelOverride === actualPendingCancel
    ) {
      setPendingCancelOverride(null);
    }
  }, [pendingCancelOverride, actualPendingCancel]);

  async function handleManagePayment() {
    if (!dbUser.stripeCustomerId) return;
    setPortalError(null);
    setPortalOpening(true);
    try {
      const result = await createPortal({
        stripeCustomerId: dbUser.stripeCustomerId,
      });
      if (result.url) {
        window.location.href = result.url;
      } else {
        setPortalError("Couldn't open the billing portal. Please try again.");
      }
    } catch {
      setPortalError("Couldn't open the billing portal. Please try again.");
    } finally {
      setPortalOpening(false);
    }
  }

  async function handleCancelSubscription() {
    if (!dbUser.stripeSubscriptionId) return;
    setPortalError(null);
    setSubActionError(null);
    setCancelling(true);
    const result = await cancelSub({
      stripeSubscriptionId: dbUser.stripeSubscriptionId,
    });
    setCancelling(false);
    if (!result.ok) {
      setSubActionError(
        result.reason === "already_ended"
          ? "Your subscription has already ended. Please start a new one."
          : "Something went wrong. Please try again."
      );
      setShowCancel(false);
      return;
    }
    setPendingCancelOverride(true);
    setShowCancel(false);
  }

  async function handleResumeSubscription() {
    if (!dbUser.stripeSubscriptionId) return;
    setPortalError(null);
    setSubActionError(null);
    setResuming(true);
    const result = await resumeSub({
      stripeSubscriptionId: dbUser.stripeSubscriptionId,
    });
    setResuming(false);
    if (!result.ok) {
      setSubActionError(
        result.reason === "already_ended"
          ? "Your subscription has already ended. Please start a new one."
          : "Something went wrong. Please try again."
      );
      return;
    }
    setPendingCancelOverride(false);
  }

  const pendingCancel = pendingCancelOverride ?? actualPendingCancel;

  const nextBillingDate = dbUser.currentPeriodEnd
    ? new Date(dbUser.currentPeriodEnd).toLocaleDateString()
    : null;

  const statusLabel = pendingCancel
    ? `Cancelled — access until ${nextBillingDate ?? "period end"}`
    : dbUser.subscriptionStatus === "active" ||
        dbUser.subscriptionStatus === "trialing"
      ? "Active"
      : dbUser.subscriptionStatus;

  // Cancel confirmation screen
  if (showCancel) {
    const endDate = nextBillingDate ?? "your billing period end";
    return (
      <main className="min-h-screen bg-[#FAF6F1] pb-24">
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-[#1A3A2A] mb-4">
              Cancel your subscription?
            </h2>
            <p className="text-gray-500 mb-2">
              You&apos;ll keep access until <strong>{endDate}</strong>. You
              won&apos;t be charged again.
            </p>
            <p className="text-gray-400 text-sm mb-8">
              Your recipes, pantry, and favourites will be saved.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setShowCancel(false)}
                className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium hover:bg-[#2a5a3a] transition-colors"
              >
                Keep my subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={cancelling}
                className="w-full py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAF6F1] pb-24">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link
          href="/"
          className="text-[#D4622A] text-sm hover:underline mb-4 inline-block mt-6 sm:mt-0"
        >
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-8">Subscription</h1>

        {/* Payment section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Payment
          </h2>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Card on file</p>
            <button
              onClick={handleManagePayment}
              disabled={portalOpening}
              className="text-sm text-[#D4622A] hover:underline disabled:opacity-50"
            >
              {portalOpening ? "Opening..." : "Update card"}
            </button>
          </div>
          {portalError && (
            <p className="text-sm text-red-500 mt-3">{portalError}</p>
          )}
        </section>

        {/* Subscription section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Subscription
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Status</p>
              <p className="text-sm font-medium text-gray-900">{statusLabel}</p>
            </div>

            {nextBillingDate && !pendingCancel && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">Next charge</p>
                <p className="text-sm text-gray-900">
                  $2.99 on {nextBillingDate}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              {pendingCancel ? (
                <button
                  onClick={handleResumeSubscription}
                  disabled={resuming}
                  className="bg-[#1A3A2A] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
                >
                  {resuming ? "Resuming..." : "Resume subscription"}
                </button>
              ) : (
                <button
                  onClick={() => setShowCancel(true)}
                  className="text-sm text-red-500 hover:text-red-600 transition-colors"
                >
                  Cancel subscription
                </button>
              )}
              {subActionError && (
                <p className="text-sm text-red-500 mt-3">{subActionError}</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
