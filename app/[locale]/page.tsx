import { redirect, notFound } from "next/navigation";
import HomePage, { generateMetadata } from "@/app/home-page";

export { generateMetadata };
export const dynamic = "force-dynamic";

export default async function LocaleHome(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ v?: string; q?: string }> }) {
  const [{ locale }, searchParams] = await Promise.all([props.params, props.searchParams]);
  if (locale === "pl") redirect("/");
  if (locale !== "en") notFound();
  return <HomePage locale="en" searchParams={searchParams} />;
}
