import { redirect } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getLocalizedHref } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

export default async function RootRedirect() {
  const locale = await resolveInitialLanguage();
  redirect(getLocalizedHref(locale, "home"));
}
