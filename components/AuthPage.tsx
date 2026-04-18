"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-[#1A3A2A]" style={{ fontFamily: "var(--font-playfair)" }}>
            fridge to table
          </Link>
        </div>

        {initialMode === "sign-in" ? (
          <SignIn
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white rounded-2xl shadow-sm border border-gray-100 w-full",
                headerTitle: "text-lg font-semibold text-gray-800",
                formButtonPrimary: "bg-[#1A3A2A] hover:bg-[#2a5a3a] text-white rounded-xl",
                formFieldInput: "rounded-xl border-gray-300 focus:border-[#D4622A]",
                footerActionLink: "text-[#D4622A] hover:text-[#BF5525]",
              },
            }}
          />
        ) : (
          <SignUp
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/settings"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-white rounded-2xl shadow-sm border border-gray-100 w-full",
                headerTitle: "text-lg font-semibold text-gray-800",
                formButtonPrimary: "bg-[#1A3A2A] hover:bg-[#2a5a3a] text-white rounded-xl",
                formFieldInput: "rounded-xl border-gray-300 focus:border-[#D4622A]",
                footerActionLink: "text-[#D4622A] hover:text-[#BF5525]",
              },
            }}
          />
        )}

        {/* Terms footer */}
        <p className="text-xs text-gray-400 text-center mt-6">
          By continuing you agree to our{" "}
          <span className="underline">Terms</span> and{" "}
          <span className="underline">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
