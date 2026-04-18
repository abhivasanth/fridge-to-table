"use client";

import { ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ConvexReactClient } from "convex/react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Wraps the app with Clerk + Convex auth integration.
// `ConvexProviderWithClerk` keeps the Convex client's auth token in sync with
// Clerk's session: every Convex query/mutation is automatically called with
// the authenticated user's JWT, which Convex validates against the configured
// Clerk JWT issuer (see convex/auth.config.ts).
//
// There's deliberately no `UserSync` effect — Clerk is the source of truth
// for identity; we don't maintain a mirror `users` table until a feature
// requires server-side per-user metadata.
export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
