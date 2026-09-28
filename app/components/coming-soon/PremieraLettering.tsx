import { PREMIERA_PATH, PREMIERE_PATH, PREMIERA_VIEWBOX } from "./premiera-lettering";

export function PremieraLettering({ isPl, className }: { isPl: boolean; className?: string }) {
  const label = isPl ? "PREMIERA" : "PREMIERE";
  return (
    <svg viewBox={PREMIERA_VIEWBOX} className={className} role="img" aria-label={label} fill="currentColor">
      <path d={isPl ? PREMIERA_PATH : PREMIERE_PATH} />
    </svg>
  );
}
