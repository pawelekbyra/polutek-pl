// experiment: premium-pass (docs/experiments/premium-pass.md, section 8.2): the offer page /premium, /en/premium,
// /<lang>/premium: "become a patron of the project and get into the patron zone". Rendered per viewer (404 when the
// experiment is invisible to them), never indexed.
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
  resolvePremiumPayments,
  toPremiumPaymentsDto,
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
import { passDate, price, vatLine } from "./pass-copy";
import styles from "./premium-pass.module.css";

export type PassOfferPageProps = { params: Promise<{ locale: string }> };

export async function passOfferMetadata(props: PassOfferPageProps): Promise<Metadata> {
  const { locale: raw } = await props.params;
  const tx = await getServerTx(isLocale(raw) ? raw : "pl");
  return { title: `${tx("Zostań patronem", "Become a patron")} · ${APP_NAME}`, robots: { index: false, follow: false } };
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
  const payments = toPremiumPaymentsDto(resolvePremiumPayments());
  const offer = status?.ok ? status.data.offer : buildPremiumPassOffer({ signedIn: false, premiumCount: rows.length, payments });
  const demo = payments.mode === "demo";
  const testMode = payments.mode === "stripe" && payments.available && payments.stripeMode === "test";
  await notePassFunnelEvent(ctx, "offer_view");
  const firstSlug = rows[0]?.slug ?? null;

  return (
    <AuthSessionSeedProvider snapshot={toAuthSessionSnapshot(session)}>
      <div className={`public-visual-shell min-h-screen bg-[var(--chan-nav)] font-sans text-[var(--chan-ink)] ${styles.pass}`}>
        {demo && <DemoRibbon />}
        <Navbar />
        <main id="main" tabIndex={-1} className="focus:outline-none">
          <section className={styles.heroBand} aria-labelledby="pass-title">
            <div className={styles.heroInner}>
              <div className={styles.eyebrow}>
                {tx("Strefa patrona", "Patron zone")}
                {demo && ` · ${tx("tryb demo", "demo mode")}`}
                {testMode && ` · ${tx("tryb testowy", "test mode")}`}
              </div>
              <h1 id="pass-title" className={styles.heroTitle}>{tx("Zostań patronem i uzyskaj dostęp do strefy premium", "Become a patron and get access to the premium zone")}</h1>
              <p className={styles.heroLead}>
                {tx(
                  "Wesprzyj projekt i wejdź do strefy patrona: materiały, których nie ma nigdzie indziej. Płacisz, ile chcesz, a dostęp trwa {0} dni. Bez subskrypcji.",
                  "Support the project and enter the patron zone: material you won't find anywhere else. You pay what you want and access lasts {0} days. No subscription.",
                  offer.accessDays,
                )}
              </p>
              {videos.length > 0 && (
                <ul className={styles.inside} aria-label={tx("Filmy w strefie patrona", "Videos in the patron zone")}>
                  {videos.map((video) => (
                    <li key={video.id}>
                      <div className={styles.art}>
                        {video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" loading="lazy" />}
                        <span className={`${styles.badge} ${styles.thumbBadge}`}><LockIcon />PATRON</span>
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
                    ? tx("Strefa patrona otwarta do {0}. Kolejna wpłata przedłuży dostęp o {1} dni.", "Patron zone open until {0}. Another payment extends your access by {1} days.", passDate(locale, pass.expiresAt, true), offer.accessDays)
                    : tx("Twój dostęp do strefy patrona wygasł {0}.", "Your patron zone access expired on {0}.", passDate(locale, pass.expiresAt))}
                </p>
              )}
              <article className={`${styles.priceCard} ${styles.priceCardBest}`} aria-labelledby="pass-card">
                <h2 id="pass-card" className={styles.kicker}>{tx("Dostęp do strefy patrona", "Patron zone access")}</h2>
                <div className={styles.price}>
                  <b>{tx("od {0}", "from {0}", price(locale, offer.minMinor))}</b>
                  <span>{tx("płacisz, ile chcesz", "pay what you want")}</span>
                </div>
                <div className={styles.muted}>{vatLine(tx, offer.vatRatePercent)}</div>
                <ul className={styles.perks}>
                  <li>{tx("Wszystkie filmy strefy patrona ({0})", "All patron zone videos ({0})", offer.premiumCount)}</li>
                  <li>{tx("Dostęp od razu, na {0} dni od każdej wpłaty", "Instant access for {0} days after every payment", offer.accessDays)}</li>
                  <li>{tx("Kolejna wpłata przedłuża dostęp, nic nie odnawia się samo", "Another payment extends your access, nothing renews by itself")}</li>
                  <li>{tx("Na każdym urządzeniu po zalogowaniu", "On every device you sign in on")}</li>
                </ul>
                <PassOfferActions offer={offer} firstSlug={firstSlug} />
              </article>
              <p className={styles.secure}>
                <ShieldIcon />
                {demo
                  ? tx("Płatność obsługuje operator płatności (w demo: symulacja, nic nie zostanie pobrane)", "Payments are handled by a payment provider (in the demo: simulated, nothing is charged)")
                  : tx("Płatność obsługuje Stripe. Nie widzimy ani nie przechowujemy danych Twojej karty.", "Payments are handled by Stripe. We never see or store your card details.")}
              </p>
            </div>

            <section className={styles.faq} aria-labelledby="pass-faq">
              <h2 id="pass-faq">{tx("Najczęstsze pytania", "Frequently asked questions")}</h2>
              <details open>
                <summary>{tx("Czy to subskrypcja?", "Is this a subscription?")}</summary>
                <p>{tx("Nie. Każda wpłata to jednorazowa opłata za dostęp na określoną liczbę dni. Nic nie pobierzemy ponownie i nie ma czego anulować.", "No. Every payment is a one-time payment for access for a set number of days. Nothing is charged again and there is nothing to cancel.")}</p>
              </details>
              <details>
                <summary>{tx("Ile mogę wpłacić?", "How much can I pay?")}</summary>
                <p>{tx("Od {0} do {1}, wpisz kwotę, jaką chcesz. Kwota nie zmienia długości dostępu.", "From {0} to {1}: enter any amount you like. The amount does not change how long access lasts.", price(locale, offer.minMinor), price(locale, offer.maxMinor))}</p>
              </details>
              <details>
                <summary>{tx("Od kiedy liczy się czas?", "When does the time start?")}</summary>
                <p>{tx("Od chwili, gdy płatność zostanie potwierdzona. Jeśli dostęp trwa, kolejna wpłata dodaje dni do jego końca. Datę końca widzisz w potwierdzeniu i w „Moje konto”.", "From the moment the payment is confirmed. If your access is still running, another payment adds days to its end. You see the end date in the confirmation and in “My account”.")}</p>
              </details>
              <details>
                <summary>{tx("Czy mogę odstąpić od umowy?", "Can I withdraw from the contract?")}</summary>
                <p>{tx("Prosisz o dostęp od razu, więc po rozpoczęciu oglądania tracisz prawo odstąpienia (treści cyfrowe). Zapytamy o zgodę w kasie.", "You ask for access right away, so once you start watching you lose the right to withdraw (digital content). We ask for your consent at checkout.")}</p>
              </details>
              <details>
                <summary>{tx("Kontakt", "Contact")}</summary>
                <p>support@pawelperfect.com</p>
              </details>
            </section>
          </div>
        </main>
        <Footer />
        {session.userId && (demo || testMode) && <PassOfferDemoControls />}
      </div>
    </AuthSessionSeedProvider>
  );
}
