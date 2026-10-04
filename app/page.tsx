import { redirect } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import { getExplicitLocaleHref } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

// The proxy (middleware.ts) normally serves "/" itself, so this is only a fallback. Like the other
// bare-path pages next to it, it redirects to a path that names its locale ("/pl", "/en"), which can
// never lead back here (the bare Polish href of getLocalizedHref would be "/" again).
export default async function RootRedirect() {
  const locale = await resolveInitialLanguage();
  redirect(getExplicitLocaleHref(locale, "home"));
}
