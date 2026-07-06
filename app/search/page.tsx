import { redirect } from "next/navigation";
import SearchPage from "@/app/[locale]/search/page";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { appendQueryString, getLocalizedHref } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

export default async function RootSearchPage(props: { searchParams: Promise<{ q?: string }> }) {
  const [searchParams, locale] = await Promise.all([props.searchParams, resolveInitialLanguage()]);
  if (locale === "en") {
    const query = new URLSearchParams();
    if (searchParams.q) query.set("q", searchParams.q);
    redirect(appendQueryString(getLocalizedHref("en", "search"), query));
  }
  return <SearchPage params={Promise.resolve({ locale: "pl" })} searchParams={Promise.resolve(searchParams)} />;
}
