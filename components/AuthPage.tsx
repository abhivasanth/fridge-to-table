"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { WordmarkLogo } from "./WordmarkLogo";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="fridge to table — home">
            <WordmarkLogo width={180} height={40} />
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
        )}

        <p className="text-xs text-gray-400 text-center mt-6">
          By continuing you agree to our{" "}
          <span className="underline">Terms</span> and{" "}
          <span className="underline">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
}
