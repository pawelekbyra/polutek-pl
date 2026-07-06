import { redirect } from "next/navigation";
import PolitykaPrywatnosciPage from "@/app/[locale]/polityka-prywatnosci/page";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getLocalizedHref } from "@/lib/i18n/routing";

export default async function RootPolitykaPrywatnosciPage() {
  if ((await resolveInitialLanguage()) === "en") redirect(getLocalizedHref("en", "privacy"));
  return <PolitykaPrywatnosciPage params={Promise.resolve({ locale: "pl" })} />;
}
