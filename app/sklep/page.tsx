import { redirect } from "next/navigation";
import SklepPage from "@/app/[locale]/sklep/page";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getLocalizedHref } from "@/lib/i18n/routing";

export default async function RootSklepPage() {
  if ((await resolveInitialLanguage()) === "en") redirect(getLocalizedHref("en", "shop"));
  return <SklepPage params={Promise.resolve({ locale: "pl" })} />;
}
