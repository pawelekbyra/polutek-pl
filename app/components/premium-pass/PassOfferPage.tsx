// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.2): the offer (pricing) page /premium,
// /en/premium, /<lang>/premium. Rendered per viewer (404 when the experiment is invisible to them), never indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { auth } from "@/lib/auth/server";
import { toAuthSessionSnapshot } from "@/lib/auth/session-snapshot";
import { AuthSessionSeedProvider } from "@/lib/auth/react";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import {
  buildPremiumPassOffer,
  getPremiumPassStatus,
  listPremiumPassVideos,
  notePassFunnelEvent,
  premiumPassFor,
  type PassStatusDto,
} from "@/lib/modules/experiment-premium-pass";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import type { PublicVideoDTO } from "@/app/types/video";
import { getServerTx } from "@/lib/i18n/server-tx";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { APP_NAME } from "@/lib/constants";
import { DemoRibbon } from "./DemoRibbon";
import { LockIcon, ShieldIcon } from "./PassIcons";
import { PassOfferActions, PassOfferDemoControls } from "./PassOfferActions";
import { passDate, passName, price, vatLine } from "./pass-copy";
import styles from "./premium-pass.module.css";

export type PassOfferPageProps = { params: Promise<{ locale: string }> };

export async function passOfferMetadata(props: PassOfferPageProps): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const tx = await getServerTx(isLocale(raw) ? raw : "pl");
  return { title: `${tx("Wejściówka za kulisy", "Backstage pass")} · ${APP_NAME}`, robots: { index: false, follow: false } };
}

export default async function PassOfferPage({ params }: PassOfferPageProps) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const actor = await getActorFromAuth();
  const config = premiumPassFor(actor);
  if (!config) notFound();

  const tx = await getServerTx(locale);
  const session = await auth();
  const ctx = createAppContext({ actor });
  const now = ctx.now();
  const rows = await listPremiumPassVideos(ctx, config, now);
  const videos = (await Promise.all(rows.map((row) => VideoContentService.getPublicVideoByIdOrSlug(row.id).catch(() => null)))).filter(
    (video): video is PublicVideoDTO => video !== null,
  );
  const status = session.userId ? await getPremiumPassStatus(ctx) : null;
  const pass: PassStatusDto = status?.ok ? status.data.pass : { state: "none" };
  const offer = status?.ok ? status.data.offer : buildPremiumPassOffer({ signedIn: false, premiumCount: rows.length });
  await notePassFunnelEvent(ctx, "offer_view");
  const firstSlug = rows[0]?.slug ?? null;
  const days = offer.products.map((p) => p.days).join("/");

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className={`public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)] ${styles.pass}`}>
        <DemoRibbon />
        <Navbar />
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <section className={styles.heroBand} aria-labelledby="pass-title">
            <div className={styles.heroInner}>
              <div className={styles.eyebrow}>{tx("Wejściówka Premium · tryb demo", "Premium pass · demo mode")}</div>
              <h1 id="pass-title" className={styles.heroTitle}>{tx("Wejściówka za kulisy", "Backstage pass")}</h1>
              <p className={styles.heroLead}>
                {tx("Materiały, których nie ma nigdzie indziej. Jedna opłata, {0} dni, bez subskrypcji.", "Material you won't find anywhere else. One payment, {0} days, no subscription.", days)}
              </p>
              {videos.length > 0 && (
                <ul className={styles.inside} aria-label={tx("Filmy w wejściówce", "Videos in the pass")}>
                  {videos.map((video) => (
                    <li key={video.id}>
                      <div className={styles.art}>
                        {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                        <span className={`${styles.badge} ${styles.thumbBadge}`}><LockIcon />PREMIUM</span>
                        {video.duration && <span className={styles.dur}>{video.duration}</span>}
                      </div>
                      <div className={styles.cap}>{getVideoDisplayTitle(video, locale)}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <div className={styles.body}>
            <div>
              {pass.state !== "none" && (
                <p className={styles.status} role="status">
                  {pass.state === "active"
                    ? tx("Wejściówka aktywna do {0}.", "Pass active until {0}.", passDate(locale, pass.expiresAt, true))
                    : tx("Twoja wejściówka wygasła {0}.", "Your pass expired on {0}.", passDate(locale, pass.expiresAt))}
                </p>
              )}
              <div className={styles.cards}>
                {offer.products.map((product) => (
                  <article key={product.id} className={`${styles.priceCard} ${product.bestValue ? styles.priceCardBest : ""}`} aria-labelledby={`pass-${product.id}`}>
                    {product.bestValue && <span className={styles.bestValue}>{tx("Najlepsza wartość", "Best value")}</span>}
                    <h2 id={`pass-${product.id}`} className={styles.kicker}>{passName(tx, product.id)}</h2>
                    <div className={styles.price}>
                      <b>{price(locale, product.priceMinor)}</b>
                      <span>{tx("jednorazowo", "one-time")}</span>
                    </div>
                    <div className={styles.muted}>{vatLine(tx, offer.vatRatePercent)}</div>
                    <ul className={styles.perks}>
                      <li>{tx("Wszystkie filmy Premium ({0})", "All Premium videos ({0})", offer.premiumCount)}</li>
                      <li>{tx("Dostęp od razu, przez {0} dni", "Instant access for {0} days", product.days)}</li>
                      <li>{tx("Nie odnawia się, bez subskrypcji", "Does not renew, no subscription")}</li>
                      <li>{tx("Na każdym urządzeniu po zalogowaniu", "On every device you sign in on")}</li>
                    </ul>
                    <PassOfferActions offer={offer} productId={product.id} firstSlug={firstSlug} />
                  </article>
                ))}
              </div>
              <ul className={styles.methodLogos} aria-label={tx("Metody płatności", "Payment methods")}>
                {["BLIK", "VISA", "Mastercard", "Apple Pay", "Google Pay", "Przelewy24"].map((m) => <li key={m}>{m}</li>)}
              </ul>
              <p className={styles.secure}>
                <ShieldIcon />
                {tx("Płatność obsługuje operator płatności (w demo: symulacja, nic nie zostanie pobrane)", "Payments are handled by a payment provider (in the demo: simulated, nothing is charged)")}
              </p>
            </div>

            <section className={styles.faq} aria-labelledby="pass-faq">
              <h2 id="pass-faq">{tx("Najczęstsze pytania", "Frequently asked questions")}</h2>
              <details open>
                <summary>{tx("Czy wejściówka się odnawia?", "Does the pass renew?")}</summary>
                <p>{tx("Nie. To jednorazowa opłata za wybraną liczbę dni. Nic nie pobierzemy ponownie i nie ma czego anulować.", "No. It is a one-time payment for the chosen number of days. Nothing is charged again and there is nothing to cancel.")}</p>
              </details>
              <details>
                <summary>{tx("Od kiedy liczy się czas?", "When does the time start?")}</summary>
                <p>{tx("Od chwili zakupu. Datę końca widzisz w potwierdzeniu i w „Moje konto”.", "From the moment of purchase. You see the end date in the confirmation and in “My account”.")}</p>
              </details>
              <details>
                <summary>{tx("Na ilu urządzeniach mogę oglądać?", "On how many devices can I watch?")}</summary>
                <p>{tx("Na każdym, na którym się zalogujesz.", "On every device you sign in on.")}</p>
              </details>
              <details>
                <summary>{tx("Czy mogę odstąpić od umowy?", "Can I withdraw from the contract?")}</summary>
                <p>{tx("Prosisz o dostęp od razu, więc po rozpoczęciu oglądania tracisz prawo odstąpienia (treści cyfrowe). Zapytamy o zgodę w kasie.", "You ask for access right away, so once you start watching you lose the right to withdraw (digital content). We ask for your consent at checkout.")}</p>
              </details>
              <details>
                <summary>{tx("Co, jeśli film zniknie?", "What if a video disappears?")}</summary>
                <p>{tx("W prawdziwej sprzedaży zasady opisze regulamin. To jest pokaz: nic nie jest pobierane.", "In a real sale the terms would cover this. This is a demo: nothing is charged.")}</p>
              </details>
              <details>
                <summary>{tx("Kontakt", "Contact")}</summary>
                <p>support@pawelperfect.com</p>
              </details>
            </section>
          </div>
        </main>
        <Footer />
        {session.userId && <PassOfferDemoControls />}
      </div>
    </AuthSessionSeedProvider>
  );
}
