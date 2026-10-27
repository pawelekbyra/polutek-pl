// patron zone (docs/architecture/patron-zone.md): the offer page /premium, /en/premium,
// /<lang>/premium: "become a patron of the project and get into the patron zone". Rendered per viewer (404 when the
// patron zone is invisible to them), never indexed.
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
  patronCurrencyForLanguage,
  premiumPassFor,
  resolvePremiumPayments,
  toPremiumPaymentsDto,
  type PassStatusDto,
} from "@/lib/modules/patron-zone";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import type { PublicVideoDTO } from "@/app/types/video";
import { getServerTx } from "@/lib/i18n/server-tx";
import { isLocale, type Locale } from "@/lib/i18n/routing";
import { getVideoDisplayTitle } from "@/lib/video-title-overrides";
import { APP_NAME } from "@/lib/constants";
import { DemoRibbon } from "./DemoRibbon";
import { LockIcon, ShieldIcon } from "./PassIcons";
import { PassOfferActions, PassOfferDemoControls } from "./PassOfferActions";
import { PATRON_SUPPORT_EMAIL, passDate, price, productName, vatLine } from "./pass-copy";
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
  const currency = patronCurrencyForLanguage(locale);
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
                  "Wesprzyj projekt i wejdź do strefy patrona: materiały, których nie ma nigdzie indziej. Wybierz dostęp na 30 dni albo bez limitu. Bez subskrypcji.",
                  "Support the project and enter the patron zone: material you won't find anywhere else. Choose 30-day or unlimited access. No subscription.",
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
                  {pass.state === "active" && pass.lifetime
                    ? tx("Masz dostęp bez limitu.", "You have unlimited access.")
                    : pass.state === "active" && pass.expiresAt
                      ? tx("Strefa patrona otwarta do {0}. Kolejna wpłata przedłuży dostęp o 30 dni, dostęp bez limitu zamieni go na stały.", "Patron zone open until {0}. Another payment extends your access by 30 days, unlimited access makes it permanent.", passDate(locale, pass.expiresAt, true))
                      : pass.expiresAt
                        ? tx("Twój dostęp do strefy patrona wygasł {0}.", "Your patron zone access expired on {0}.", passDate(locale, pass.expiresAt))
                        : null}
                </p>
              )}
              <div className={styles.cards}>
                {offer.products.map((product) => (
                  <article key={product.id} className={`${styles.priceCard} ${product.bestValue ? styles.priceCardBest : ""}`} aria-labelledby={`pass-${product.id}`}>
                    {product.bestValue && <span className={styles.bestValue}>{tx("Bestseller", "Bestseller")}</span>}
                    <h2 id={`pass-${product.id}`} className={styles.kicker}>{productName(tx, product.id)}</h2>
                    <div className={styles.price}>
                      <b>{price(locale, product.prices[currency], currency)}</b>
                      <span>{tx("jednorazowo", "one-time")}</span>
                    </div>
                    <div className={styles.muted}>{vatLine(tx)}</div>
                    <ul className={styles.perks}>
                      <li>{tx("Wszystkie filmy strefy patrona ({0})", "All patron zone videos ({0})", offer.premiumCount)}</li>
                      <li>{product.days === null ? tx("Dostęp od razu i bez końca", "Instant access with no end date") : tx("Dostęp od razu, na {0} dni", "Instant access for {0} days", product.days)}</li>
                      <li>{product.days === null ? tx("Płacisz raz, bez subskrypcji", "Pay once, no subscription") : tx("Kolejna wpłata przedłuża dostęp, nic nie odnawia się samo", "Another payment extends your access, nothing renews by itself")}</li>
                      <li>{tx("Na każdym urządzeniu po zalogowaniu", "On every device you sign in on")}</li>
                    </ul>
                    <PassOfferActions offer={offer} productId={product.id} firstSlug={firstSlug} />
                  </article>
                ))}
              </div>
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
                <p>{tx("Nie. Każda wpłata to jednorazowa opłata: dostęp na 30 dni kończy się po 30 dniach, a dostęp bez limitu nie ma końca. Nic nie pobierzemy ponownie i nie ma czego anulować.", "No. Every payment is a one-time payment: 30-day access ends after 30 days, unlimited access has no end. Nothing is charged again and there is nothing to cancel.")}</p>
              </details>
              <details>
                <summary>{tx("Czym różnią się dwa dostępy?", "What is the difference between the two options?")}</summary>
                <p>{tx("Dostęp na 30 dni możesz przedłużać kolejnymi wpłatami. Dostęp bez limitu płacisz raz i zostaje na stałe; jeśli masz już dostęp na 30 dni, zamieni go na stały.", "You can extend 30-day access with further payments. Unlimited access is paid once and stays for good; if you already have 30-day access, it turns it into permanent access.")}</p>
              </details>
              <details>
                <summary>{tx("Od kiedy liczy się czas?", "When does the time start?")}</summary>
                <p>{tx("Od chwili, gdy płatność zostanie potwierdzona. Jeśli dostęp na 30 dni trwa, kolejna wpłata dodaje 30 dni do jego końca. Datę końca widzisz w potwierdzeniu i w „Moje konto”.", "From the moment the payment is confirmed. If your 30-day access is still running, another payment adds 30 days to its end. You see the end date in the confirmation and in “My account”.")}</p>
              </details>
              <details>
                <summary>{tx("Czy mogę odstąpić od umowy?", "Can I withdraw from the contract?")}</summary>
                <p>{tx("Prosisz o dostęp od razu, więc po rozpoczęciu oglądania tracisz prawo odstąpienia (treści cyfrowe). Zapytamy o zgodę w kasie.", "You ask for access right away, so once you start watching you lose the right to withdraw (digital content). We ask for your consent at checkout.")}</p>
              </details>
              <details>
                <summary>{tx("Kontakt", "Contact")}</summary>
                <p>{PATRON_SUPPORT_EMAIL}</p>
              </details>
            </section>
          </div>
        </main>
        <Footer />
        {session.userId && demo && <PassOfferDemoControls />}
      </div>
    </AuthSessionSeedProvider>
  );
}
