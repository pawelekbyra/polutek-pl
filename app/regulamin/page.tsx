import { redirect } from "next/navigation";
import RegulaminPage from "@/app/[locale]/regulamin/page";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getLocalizedHref } from "@/lib/i18n/routing";

export default async function RootRegulaminPage() {
  if ((await resolveInitialLanguage()) === "en") redirect(getLocalizedHref("en", "terms"));
  return <RegulaminPage params={Promise.resolve({ locale: "pl" })} />;
}
