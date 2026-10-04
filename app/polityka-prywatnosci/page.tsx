import { redirect } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getExplicitLocaleHref } from "@/lib/i18n/routing";
export default async function RedirectPrivacy(){ redirect(getExplicitLocaleHref(await resolveInitialLanguage(), "privacy")); }
