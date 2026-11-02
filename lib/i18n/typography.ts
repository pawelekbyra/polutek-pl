import type { Locale } from "@/lib/i18n/routing";

/**
 * Typographic line-break protection for short interface texts (dialog titles, one-sentence
 * descriptions). It only swaps ordinary spaces for no-break spaces, so the catalogs keep clean
 * translations and the same logic covers every language:
 *
 *  - Latin-script languages: a one- or two-letter word (pl "w", "na", "do"; en "a", "to"; de "zu";
 *    fr "de", "et"; ...) stays glued to the word after it, never ending a line alone. The pair is
 *    glued only when the next word is short enough, so no unbreakable chunk can outgrow a narrow card.
 *  - French: no line starts with "?", "!", ":", ";" or ends right after an opening guillemet.
 *  - `widow`: the last two words travel together, so the last line is never one lonely word
 *    (fallback for browsers without `text-wrap: balance|pretty`; they do the same job better).
 *  - Chinese has no spaces: line breaking is left to CSS (`line-break: strict`).
 */
const NBSP = " ";
/** Longest following word a short word may be glued to (keeps the unbreakable unit narrow). */
const MAX_GLUED_WORD = 16;
/** Longest "second to last + last word" pair that is kept together. */
const MAX_WIDOW_PAIR = 24;

const SHORT_WORD_THEN_WORD = /(?<![\p{L}\p{N}])(\p{L}{1,2}) (?=(\S+))/gu;

export function tidyWrap(text: string, language: Locale, options: { widow?: boolean } = {}): string {
  if (language === "zh") return text;
  let out = text;
  if (language === "fr") {
    out = out.replace(/ ([?!:;»])/g, `${NBSP}$1`).replace(/(«) /g, `$1${NBSP}`);
  }
  out = out.replace(SHORT_WORD_THEN_WORD, (whole, short: string, next: string) =>
    next.length <= MAX_GLUED_WORD ? `${short}${NBSP}` : whole,
  );
  if (options.widow) {
    const at = out.lastIndexOf(" ");
    if (at > 0) {
      const before = Math.max(out.lastIndexOf(" ", at - 1), out.lastIndexOf(NBSP, at - 1));
      if (out.length - (before + 1) <= MAX_WIDOW_PAIR) out = `${out.slice(0, at)}${NBSP}${out.slice(at + 1)}`;
    }
  }
  return out;
}
