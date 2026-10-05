import { PREMIERA_PATH, PREMIERE_PATH, PREMIERA_VIEWBOX } from "./premiera-lettering";
import type { Tx } from "@/lib/i18n/ui";

export function PremieraLettering({ tx, className }: { tx: Tx; className?: string }) {
  const label = tx("PREMIERA", "PREMIERE");
  return (
    <svg viewBox={PREMIERA_VIEWBOX} className={className} role="img" aria-label={label} fill="currentColor">
      <path d={(tx.language === "pl") ? PREMIERA_PATH : PREMIERE_PATH} />
    </svg>
  );
}
