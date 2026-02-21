"use client";
// Must be a client component — ConvexProvider uses React context and browser APIs
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Initialise the Convex client once. NEXT_PUBLIC_CONVEX_URL is safe to expose
// to the browser — it's just a URL, not a secret key.
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
