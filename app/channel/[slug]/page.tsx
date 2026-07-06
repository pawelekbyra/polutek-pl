import { redirect } from "next/navigation";
import ChannelPage, { generateMetadata } from "@/app/[locale]/channel/[slug]/page";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { appendQueryString, getLocalizedHref } from "@/lib/i18n/routing";

export { generateMetadata };
export const revalidate = 60;

export default async function RootChannelPage(props: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ slug }, searchParams, locale] = await Promise.all([props.params, props.searchParams, resolveInitialLanguage()]);
  if (locale === "en") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
      else if (value) query.set(key, value);
    }
    redirect(appendQueryString(getLocalizedHref("en", "channel", { slug }), query));
  }
  return <ChannelPage params={Promise.resolve({ locale: "pl", slug })} />;
}
