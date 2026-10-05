import { Fragment, type ReactNode } from "react";
import { PLACEHOLDER_PATTERN, type Tx } from "@/lib/i18n/ui";

/**
 * Interface text with React nodes inside it (a link, bold text): the sentence is translated whole,
 * with `{0}`, `{1}` marking where the nodes go, so word order can differ per language.
 *
 *   txRich(tx, "Akceptuję {0} i {1}.", "I accept the {0} and the {1}.", termsLink, privacyLink)
 */
export function txRich(tx: Tx, pl: string, en: string, ...nodes: ReactNode[]): ReactNode {
  const template = tx(pl, en);
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push(template.slice(last, at));
    const node = nodes[Number(match[1])];
    parts.push(<Fragment key={at}>{node}</Fragment>);
    last = at + match[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}
