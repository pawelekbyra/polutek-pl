import type { Tx } from "@/lib/i18n/ui";
import { formatCount } from "@/lib/utils";
import { countedNoun } from "@/lib/i18n/plurals";
import type { Locale } from "@/lib/i18n/routing";
import type { PublicChannelAbout } from "@/lib/modules/channel/domain/channel-about";

/** Joined date as "12 October 2026" in the page language (UTC, so server and browser agree). */
export function formatJoinedDate(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/** The About tab of a public channel page: description, links, contact (if the creator chose to show it) and stats. */
export default function ChannelAbout({
  tx,
  locale,
  description,
  about,
  subscribersCount,
  videoCount,
}: {
  tx: Tx;
  locale: Locale;
  description: string;
  about: PublicChannelAbout;
  subscribersCount: number;
  videoCount: number;
}) {
  return (
    <section className="grid gap-6 py-7 md:grid-cols-[minmax(0,1fr)_320px]" aria-label={tx("O kanale", "About the channel")}>
      <div className="grid content-start gap-6">
        <div className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface-raised)] p-5">
          <h2 className="font-brand text-lg font-bold">{tx("Opis", "Description")}</h2>
          <p className="mt-2 whitespace-pre-line break-words text-[15px] leading-relaxed text-[var(--chan-body)]">{description}</p>
        </div>

        {about.links.length > 0 && (
          <div className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface-raised)] p-5">
            <h2 className="font-brand text-lg font-bold">{tx("Linki", "Links")}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {about.links.map((link) => (
                <li key={link.url} className="min-w-0 max-w-full">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener nofollow ugc"
                    className="block max-w-full truncate rounded-full border border-[var(--chan-line)] px-4 py-2 text-[14px] font-semibold text-[var(--chan-ink)] hover:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--chan-ink)]"
                  >
                    {link.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {about.contactEmail && (
          <div className="rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface-raised)] p-5">
            <h2 className="font-brand text-lg font-bold">{tx("Kontakt", "Contact")}</h2>
            <p className="mt-2 text-[14px]">
              <a href={`mailto:${about.contactEmail}`} className="break-all font-semibold underline underline-offset-4">
                {about.contactEmail}
              </a>
            </p>
          </div>
        )}
      </div>

      <aside className="h-fit rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-surface-raised)] p-5" aria-label={tx("Statystyki kanału", "Channel stats")}>
        <h2 className="font-brand text-lg font-bold">{tx("Statystyki", "Stats")}</h2>
        <dl className="mt-3 grid gap-3 text-[14px]">
          {about.joinedAt && (
            <div>
              <dt className="text-[var(--chan-muted)]">{tx("Dołączył(a)", "Joined")}</dt>
              <dd className="font-semibold">
                <time dateTime={about.joinedAt}>{formatJoinedDate(about.joinedAt, locale)}</time>
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[var(--chan-muted)]">{tx("Subskrybenci", "Subscribers")}</dt>
            <dd className="font-semibold">{formatCount(subscribersCount)}</dd>
          </div>
          <div>
            <dt className="text-[var(--chan-muted)]">{tx("Filmy", "Videos")}</dt>
            <dd className="font-semibold">
              {formatCount(videoCount)} {countedNoun(locale, "videos", videoCount)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--chan-muted)]">{tx("Wyświetlenia", "Views")}</dt>
            <dd className="font-semibold">{formatCount(about.totalViews)}</dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}
