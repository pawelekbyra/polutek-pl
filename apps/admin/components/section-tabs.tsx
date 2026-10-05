import Link from "next/link";

export type SectionTab = readonly [id: string, label: string, href: string];

/** Sections of one module as plain links; the current one is marked for assistive tech (no client JS). */
export function SectionTabs({ label, items, current }: { label: string; items: readonly SectionTab[]; current: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map(([id, text, href]) => (
        <Link key={id} href={href} aria-current={id === current ? "page" : undefined}>
          {text}
        </Link>
      ))}
    </nav>
  );
}

/** One value of a search param that must be one of `allowed`, else the default. */
export function pickParam<T extends string>(sp: Record<string, string | string[] | undefined>, key: string, allowed: readonly T[], fallback: T): T {
  const v = sp[key];
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export const strParam = (sp: Record<string, string | string[] | undefined>, key: string, max = 120): string | undefined => {
  const v = sp[key];
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;
};
