import { redirect } from "next/navigation";

// Consolidated into /settings (which now handles plan-picker, management,
// and past-due states). Any inbound link to /pricing bounces to /settings.
export default function PricingPage() {
  redirect("/settings");
}
