import { redirect } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import HomePage, { generateMetadata } from "@/app/home-page";

export { generateMetadata };
export const dynamic = "force-dynamic";

export default async function RootHome(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  const [locale, searchParams] = await Promise.all([resolveInitialLanguage(), props.searchParams]);
  if (locale === "en") redirect("/en");
  return <HomePage locale="pl" searchParams={searchParams} />;
}
