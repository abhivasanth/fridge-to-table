import { HomePage } from "@/components/HomePage";

type ActiveTab = "any-recipe" | "chefs-table";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const initialTab: ActiveTab =
    params.tab === "chefs-table" ? "chefs-table" : "any-recipe";

  return <HomePage initialTab={initialTab} />;
}
