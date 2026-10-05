import { loadCatalog } from "@/lib/i18n/catalog";
import { createTx, type Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";

/** `tx` for server components and metadata: the same texts the client shows for `locale`. */
export async function getServerTx(locale: Locale): Promise<Tx> {
  return createTx(locale, await loadCatalog(locale));
}
