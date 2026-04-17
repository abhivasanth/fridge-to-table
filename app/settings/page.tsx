"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <SubscriptionGuard>
      <SettingsContent />
    </SubscriptionGuard>
  );
}

function SettingsContent() {
  const { user } = useUser();
  const dbUser = useQuery(
    api.users.getByClerkId,
    user ? { clerkId: user.id } : "skip"
  );
  const updateProfile = useMutation(api.users.updateProfile);
  const createPortal = useAction(api.stripe.createPortalSession);
  const cancelSub = useAction(api.stripe.cancelSubscription);

  const [firstName, setFirstName] = useState<string | null>(null);
  const [lastName, setLastName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!dbUser) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <p className="text-gray-400 animate-pulse">Loading...</p>
      </main>
    );
  }

  const displayFirstName = firstName ?? dbUser.firstName ?? "";
  const displayLastName = lastName ?? dbUser.lastName ?? "";

  async function handleSaveProfile() {
    setSaving(true);
    await updateProfile({
      firstName: displayFirstName,
      lastName: displayLastName,
    });
    setSaving(false);
  }

  async function handleManagePayment() {
    if (!dbUser?.stripeCustomerId) return;
    const result = await createPortal({
      stripeCustomerId: dbUser.stripeCustomerId,
    });
    if (result.url) {
      window.location.href = result.url;
    }
  }

  async function handleCancelSubscription() {
    if (!dbUser?.stripeSubscriptionId) return;
    setCancelling(true);
    await cancelSub({ stripeSubscriptionId: dbUser.stripeSubscriptionId });
    setCancelling(false);
    setShowCancel(false);
  }

  const statusLabel =
    dbUser.subscriptionStatus === "trialing"
      ? `Trial (ends ${new Date(dbUser.trialEndsAt!).toLocaleDateString()})`
      : dbUser.subscriptionStatus === "active"
        ? "Active"
        : dbUser.subscriptionStatus === "cancelled"
          ? "Cancelled"
          : dbUser.subscriptionStatus;

  const nextBillingDate = dbUser.currentPeriodEnd
    ? new Date(dbUser.currentPeriodEnd).toLocaleDateString()
    : null;

  const planLabel = dbUser.plan === "chef" ? "Chef" : "Basic";
  const planPrice = dbUser.plan === "chef" ? "$3" : "$2";

  // Cancel confirmation screen
  if (showCancel) {
    return (
      <main className="min-h-screen bg-[#FAF6F1] pb-24">
        <div className="max-w-lg mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <h2 className="text-xl font-bold text-[#1A3A2A] mb-4">
              Are you sure you want to cancel?
            </h2>
            <p className="text-gray-500 mb-2">
              Your access ends on{" "}
              <strong>{nextBillingDate ?? "your billing period end"}</strong>.
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
        <h1 className="text-2xl font-bold text-[#1A3A2A] mb-8">Settings</h1>

        {/* Profile section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Profile
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                type="text"
                value={displayFirstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                type="text"
                value={displayLastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <p className="text-sm text-gray-500 px-1">
                {dbUser.email}
              </p>
            </div>

            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="bg-[#1A3A2A] text-white px-6 py-2 rounded-xl text-sm font-medium hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </section>

        {/* Payment section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Payment
          </h2>

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">Card on file</p>
            <button
              onClick={handleManagePayment}
              className="text-sm text-[#D4622A] hover:underline"
            >
              Update card
            </button>
          </div>
        </section>

        {/* Subscription section */}
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Subscription
          </h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Plan</p>
              <p className="text-sm font-medium text-gray-900">{planLabel}</p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">Status</p>
              <p className="text-sm font-medium text-gray-900">{statusLabel}</p>
            </div>

            {nextBillingDate && dbUser.subscriptionStatus !== "cancelled" && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">Next charge</p>
                <p className="text-sm text-gray-900">
                  {planPrice} on {nextBillingDate}
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={() => setShowCancel(true)}
                className="text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                Cancel subscription
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
