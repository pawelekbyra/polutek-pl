import { createTx, type Tx } from "@/lib/i18n/ui";
import type { Locale } from "@/lib/i18n/routing";

const cache = new Map<Locale, Tx>();

/** A stable `tx` for tests that mock useLanguage(): same function per language, like the real provider's. */
export function txFor(language: Locale): Tx {
  let tx = cache.get(language);
  if (!tx) {
    tx = createTx(language);
    cache.set(language, tx);
  }
  return tx;
}
