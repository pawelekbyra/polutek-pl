import type { Locale as DateFnsLocale } from "date-fns";
import { de, enUS, es, fr, it, pl, ptBR, zhCN } from "date-fns/locale";
import type { Locale } from "@/lib/i18n/routing";

const DATE_FNS_LOCALES: Record<Locale, DateFnsLocale> = { pl, en: enUS, de, es, fr, it, pt: ptBR, zh: zhCN };

/** date-fns locale for relative times ("3 days ago") in the viewer's interface language. */
export function dateFnsLocale(language: Locale): DateFnsLocale {
  return DATE_FNS_LOCALES[language];
}
