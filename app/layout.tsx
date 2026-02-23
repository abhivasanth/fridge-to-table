import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { ClientNav } from "@/components/ClientNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fridge to Table",
  description: "Vegetarian recipes from what's in your fridge",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${playfairDisplay.variable} antialiased bg-[#FAF6F1]`}>
        {/* ConvexClientProvider gives all pages access to the Convex backend */}
        <ConvexClientProvider>
          {children}
          <ClientNav />
        </ConvexClientProvider>
      </body>
    </html>
  );
}
