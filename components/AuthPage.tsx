"use client";

import { useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const router = useRouter();

  const isLoaded = signInLoaded && signUpLoaded;

  async function handleGoogleAuth() {
    if (!isLoaded) return;
    setError(null);

    try {
      if (mode === "sign-in") {
        await signIn!.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sign-in/sso-callback",
          redirectUrlComplete: "/pricing",
        });
      } else {
        await signUp!.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sign-up/sso-callback",
          redirectUrlComplete: "/pricing",
        });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Something went wrong");
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setLoading(true);

    try {
      if (mode === "sign-in") {
        const result = await signIn!.create({
          identifier: email,
          password,
        });

        if (result.status === "complete") {
          await signIn!.setActive({ session: result.createdSessionId });
          router.push("/");
        }
      } else {
        const result = await signUp!.create({
          emailAddress: email,
          password,
        });

        if (result.status === "missing_requirements") {
          // Email verification needed
          await signUp!.prepareEmailAddressVerification({
            strategy: "email_code",
          });
          setPendingVerification(true);
        } else if (result.status === "complete") {
          await signUp!.setActive({ session: result.createdSessionId });
          router.push("/pricing");
        }
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerification(e: React.FormEvent) {
    e.preventDefault();
    if (!signUpLoaded) return;
    setError(null);
    setLoading(true);

    try {
      const result = await signUp!.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === "complete") {
        await signUp!.setActive({ session: result.createdSessionId });
        router.push("/pricing");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? "Invalid verification code");
    } finally {
      setLoading(false);
    }
  }

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-6">
            <Link href="/" className="text-2xl font-bold text-[#1A3A2A] font-[var(--font-playfair)]">
              fridge to table
            </Link>
          </div>

          <h2 className="text-lg font-semibold text-gray-800 text-center mb-2">
            Check your email
          </h2>
          <p className="text-sm text-gray-500 text-center mb-6">
            We sent a verification code to {email}
          </p>

          <form onSubmit={handleVerification} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verification code
              </label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="Enter code"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify email"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="text-2xl font-bold text-[#1A3A2A] font-[var(--font-playfair)]">
            fridge to table
          </Link>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 text-center mb-6">
          {mode === "sign-in" ? "Sign in to your account" : "Create your account"}
        </h2>

        {/* Tab toggle */}
        <div className="flex rounded-xl border border-gray-200 mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode("sign-in"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "sign-in"
                ? "bg-[#1A3A2A] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => { setMode("sign-up"); setError(null); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              mode === "sign-up"
                ? "bg-[#1A3A2A] text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            Sign up
          </button>
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors mb-4"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-sm text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none focus:border-[#D4622A] bg-white"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1A3A2A] text-white py-3 rounded-xl font-medium text-sm hover:bg-[#2a5a3a] transition-colors disabled:opacity-50"
          >
            {loading
              ? (mode === "sign-in" ? "Signing in..." : "Creating account...")
              : (mode === "sign-in" ? "Sign in" : "Sign up")}
          </button>
        </form>

        {/* Forgot password */}
        {mode === "sign-in" && (
          <div className="text-center mt-4">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError("Enter your email address first");
                  return;
                }
                try {
                  await signIn!.create({
                    strategy: "reset_password_email_code",
                    identifier: email,
                  });
                  setError("Check your email for a password reset link");
                } catch (err: any) {
                  setError(err.errors?.[0]?.message ?? "Could not send reset email");
                }
              }}
              className="text-sm text-[#D4622A] hover:underline"
            >
              Forgot password?
            </button>
          </div>
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
