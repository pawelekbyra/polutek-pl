// TEMPORARY logo font bake-off page shell (/logo1 … /logo20). Renders the exact
// production home experience with the wordmark font swapped, plus a small
// prev/next badge to flip between candidates. Delete with the rest of the
// experiment once a font is chosen.
import "@/app/logo-fonts.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveInitialLanguage } from "@/lib/i18n/server-language";
import HomeExperience from "@/app/components/home/HomeExperience";
import { LogoBrandProvider } from "./LogoBrandContext";
import { LOGO_FONTS, getLogoFont } from "./logo-fonts";

export default async function LogoPage({ slug }: { slug: string }) {
  const font = getLogoFont(slug);
  if (!font) notFound();

  const locale = await resolveInitialLanguage();
  const index = LOGO_FONTS.findIndex((f) => f.slug === slug);
  const prev = LOGO_FONTS[(index - 1 + LOGO_FONTS.length) % LOGO_FONTS.length];
  const next = LOGO_FONTS[(index + 1) % LOGO_FONTS.length];

  return (
    <LogoBrandProvider value={{ fontFamily: font.family, showEgg: font.egg }}>
      <HomeExperience locale={locale} />

      <div className="fixed bottom-4 left-1/2 z-[9999] flex -translate-x-1/2 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_92%,white)] px-2 py-1.5 font-sans text-[12px] shadow-[0_10px_30px_-12px_rgba(23,23,23,0.4)]">
        <Link
          href={`/${prev.slug}`}
          aria-label="Poprzednia propozycja"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--chan-muted)] transition-colors hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)]"
        >
          ◀
        </Link>
        <span className="px-2 text-[var(--chan-ink)]">
          <span className="font-bold uppercase tracking-[0.12em] text-[var(--chan-blue)]">{slug}</span>
          <span className="mx-1.5 text-[var(--chan-muted-2)]">·</span>
          <span className="font-medium">{font.label}</span>
        </span>
        <Link
          href={`/${next.slug}`}
          aria-label="Następna propozycja"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--chan-muted)] transition-colors hover:bg-[var(--chan-surface)] hover:text-[var(--chan-ink)]"
        >
          ▶
        </Link>
      </div>
    </LogoBrandProvider>
  );
}
