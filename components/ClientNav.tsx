"use client";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";

export function ClientNav() {
  const pathname = usePathname();
  if (pathname === "/") return <Navbar />;
  return <BottomNav />;
}
