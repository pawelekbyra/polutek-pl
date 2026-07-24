"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  ChevronDown,
  Clock,
  Infinity as InfinityIcon,
  Lock,
  Play,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { PublicVideoDTO } from "@/app/types/video";
import type { SecretProjectFunding } from "@/lib/modules/campaign/secret-project-funding";
import PremiumWrapper from "../PremiumWrapper";
import VideoPlayer from "../VideoPlayer";
import { useAuthModal } from "../auth/AuthModalProvider";
import { useLanguage } from "../LanguageContext";
import SecretPledgeBox from "./SecretPledgeBox";
import styles from "./SecretProject.module.css";

interface SecretProjectExperienceProps {
  pitchVideo: PublicVideoDTO | null;
  rewardVideo: PublicVideoDTO | null;
  funding: SecretProjectFunding;
  viewerIsPatron: boolean;
}

const PROJECT_TITLE = "I raise money for my secret project";

function formatAmount(value: number, isPl: boolean): string {
  return Math.floor(value).toLocaleString(isPl ? "pl-PL" : "en-US");
}

export default function SecretProjectExperience({
  pitchVideo,
  rewardVideo,
  funding,
  viewerIsPatron,
}: SecretProjectExperienceProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { isSignedIn } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const percent = funding.goalPln > 0 ? Math.min(100, (funding.raisedPln / funding.goalPln) * 100) : 0;
  const percentLabel = percent >= 10 ? Math.round(percent).toString() : percent.toFixed(1);
  const daysLeft = Math.max(0, funding.daysLeft);

  const nav = [
    { href: "#projekt", label: isPl ? "O projekcie" : "About" },
    { href: "#nagroda", label: isPl ? "Nagroda" : "Reward" },
    { href: "#faq", label: "FAQ" },
  ];

  const features = [
    {
      icon: Lock,
      title: isPl ? "Tajny materiał" : "Secret material",
      body: isPl
        ? "Dodatkowy film, którego nie zobaczysz nigdzie indziej. Dostępny wyłącznie dla wspierających kampanię."
        : "An extra video you won't see anywhere else. Available exclusively to campaign backers.",
    },
    {
      icon: InfinityIcon,
      title: isPl ? "Dostęp na zawsze" : "Access forever",
      body: isPl
        ? "Jedna wpłata i koniec. Żadnych abonamentów, odnowień ani ukrytych opłat — dostęp zostaje z Tobą dożywotnio."
        : "One pledge and that's it. No subscriptions, renewals or hidden fees — access stays with you for life.",
    },
    {
      icon: Rocket,
      title: isPl ? "Realny wpływ" : "Real impact",
      body: isPl
        ? "Każda wpłata bezpośrednio zasila produkcję i przybliża pasek postępu do celu. Widzisz efekt od razu."
        : "Every pledge directly funds production and pushes the progress bar toward the goal. You see the effect instantly.",
    },
  ];

  const faq = [
    {
      q: isPl ? "Co dokładnie wspieram?" : "What exactly am I backing?",
      a: isPl
        ? "Tajny projekt, którego szczegóły ujawniamy etapami. Zapowiedź na górze strony pokazuje kierunek — reszta pozostaje niespodzianką do premiery. Wspierasz produkcję niezależnego materiału wideo."
        : "A secret project whose details are revealed in stages. The teaser at the top shows the direction — the rest stays a surprise until launch. You're backing the production of independent video material.",
    },
    {
      q: isPl ? "Co otrzymuję za wsparcie?" : "What do I get for backing?",
      a: isPl
        ? "Natychmiastowy, dożywotni dostęp do tajnego filmu oraz do całej Strefy Fenkjuu — materiałów dostępnych wyłącznie dla wspierających."
        : "Immediate, lifetime access to the secret video and the whole Thank You Zone — materials available exclusively to backers.",
    },
    {
      q: isPl ? "Czy to abonament?" : "Is this a subscription?",
      a: isPl
        ? "Nie. To jednorazowa wpłata. Nic się nie odnawia, nic nie jest pobierane cyklicznie, a dostęp pozostaje aktywny na zawsze."
        : "No. It's a one-time pledge. Nothing renews, nothing is charged periodically, and access stays active forever.",
    },
    {
      q: isPl ? "Jak obsługiwane są płatności?" : "How are payments handled?",
      a: isPl
        ? "Płatności obsługuje Stripe — jeden z największych operatorów płatności na świecie. Nie przechowujemy danych Twojej karty."
        : "Payments are handled by Stripe — one of the largest payment processors in the world. We never store your card details.",
    },
    {
      q: isPl ? "Co jeśli kampania nie osiągnie celu?" : "What if the campaign doesn't reach its goal?",
      a: isPl
        ? "Twój dostęp do tajnego materiału i Strefy Fenkjuu pozostaje aktywny niezależnie od wyniku kampanii. Nagroda odblokowuje się od razu po wpłacie."
        : "Your access to the secret material and the Thank You Zone stays active regardless of the campaign outcome. The reward unlocks immediately after your pledge.",
    },
  ];

  return (
    <div className={`${styles.sp} min-h-screen scroll-smooth font-sans`}>
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[var(--sp-line)] bg-[rgba(7,8,13,0.78)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-3">
            <span className={`${styles.ctaGold} flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]`}>
              <Lock size={17} strokeWidth={2.6} aria-hidden="true" />
            </span>
            <span className="truncate font-brand text-[15px] font-extrabold uppercase tracking-[0.22em] text-[var(--sp-ink)]">
              Secret<span className={styles.goldText}>Project</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 md:flex" aria-label={isPl ? "Nawigacja kampanii" : "Campaign navigation"}>
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-semibold tracking-[0.02em] text-[var(--sp-muted)] transition-colors hover:text-[var(--sp-ink)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            {!isSignedIn && (
              <button
                type="button"
                onClick={() => openAuthModal("sign-in")}
                className="hidden h-10 items-center rounded-[12px] border border-[var(--sp-line-strong)] px-4 text-[13px] font-bold text-[var(--sp-body)] transition-colors hover:border-white/40 hover:text-[var(--sp-ink)] sm:flex"
              >
                {isPl ? "Zaloguj się" : "Sign in"}
              </button>
            )}
            <a
              href="#wesprzyj"
              className={`${styles.ctaGold} flex h-10 items-center rounded-[12px] px-5 font-brand text-[13px] font-extrabold tracking-[-0.01em]`}
            >
              {isPl ? "Wesprzyj" : "Back it"}
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1180px] px-4 pb-20 md:px-6 lg:px-8">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="pt-12 lg:pt-16">
          <p className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--sp-gold)]">
            <span aria-hidden="true" className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--sp-gold)] shadow-[0_0_10px_var(--sp-gold)]" />
            {isPl ? "Kampania crowdfundingowa" : "Crowdfunding campaign"}
          </p>

          <h1 className="max-w-3xl font-brand text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] text-[var(--sp-ink)] sm:text-[46px] lg:text-[56px]">
            {PROJECT_TITLE.split(" secret ")[0]}{" "}
            <span className={styles.goldText}>secret</span>{" "}
            {PROJECT_TITLE.split(" secret ")[1]}
          </h1>

          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-[var(--sp-body)] sm:text-[17px]">
            {isPl
              ? "Zbieram środki na projekt, o którym na razie nie mogę powiedzieć wszystkiego. Obejrzyj zapowiedź, wesprzyj kampanię jednorazową wpłatą i odblokuj tajny materiał dostępny wyłącznie dla wspierających."
              : "I'm raising funds for a project I can't fully talk about yet. Watch the teaser, back the campaign with a one-time pledge, and unlock the secret material available exclusively to backers."}
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
            {/* Pitch video */}
            <div className="lg:col-span-8">
              <div className={`${styles.videoGlow} relative aspect-video w-full overflow-hidden rounded-[22px] bg-black`}>
                {pitchVideo ? (
                  <PremiumWrapper videoId={pitchVideo.id} requiredTier={pitchVideo.tier}>
                    <VideoPlayer video={pitchVideo} />
                  </PremiumWrapper>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[var(--sp-muted)]">
                    <Play size={40} aria-hidden="true" />
                    <p className="text-sm font-semibold">
                      {isPl ? "Zapowiedź pojawi się wkrótce" : "The teaser is coming soon"}
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
                <Play size={13} aria-hidden="true" />
                {isPl ? "Oficjalna zapowiedź kampanii" : "Official campaign teaser"}
              </p>
            </div>

            {/* Funding panel */}
            <aside className={`${styles.panel} rounded-[26px] p-6 sm:p-7 lg:col-span-4`} aria-label={isPl ? "Postęp zbiórki" : "Funding progress"}>
              <div className="flex items-baseline justify-between gap-3">
                <p className={`${styles.goldText} font-brand text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums`}>
                  {formatAmount(funding.raisedPln, isPl)} zł
                </p>
                <span className="rounded-full border border-[var(--sp-line-strong)] px-2.5 py-1 text-[12px] font-black tabular-nums text-[var(--sp-ink)]">
                  {percentLabel}%
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-medium text-[var(--sp-muted)]">
                {isPl
                  ? `z celu ${formatAmount(funding.goalPln, isPl)} zł`
                  : `of the ${formatAmount(funding.goalPln, isPl)} zł goal`}
              </p>

              <div className={`${styles.progressTrack} mt-5`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-label={isPl ? "Postęp zbiórki" : "Funding progress"}>
                <div className={styles.progressFill} style={{ width: `${Math.max(percent, 1.5)}%` }} />
              </div>

              <dl className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-[16px] border border-[var(--sp-line)] bg-black/20 px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
                    <Users size={12} aria-hidden="true" />
                    {isPl ? "Wspierających" : "Backers"}
                  </dt>
                  <dd className="mt-1 font-brand text-[22px] font-extrabold tabular-nums text-[var(--sp-ink)]">
                    {funding.backers.toLocaleString(isPl ? "pl-PL" : "en-US")}
                  </dd>
                </div>
                <div className="rounded-[16px] border border-[var(--sp-line)] bg-black/20 px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--sp-muted)]">
                    <Clock size={12} aria-hidden="true" />
                    {isPl ? "Dni do końca" : "Days left"}
                  </dt>
                  <dd className="mt-1 font-brand text-[22px] font-extrabold tabular-nums text-[var(--sp-ink)]">
                    {daysLeft}
                  </dd>
                </div>
              </dl>

              <a
                href="#wesprzyj"
                className={`${styles.ctaGold} mt-6 flex h-[54px] w-full items-center justify-center gap-2 rounded-[16px] font-brand text-[15px] font-extrabold tracking-[-0.01em]`}
              >
                {isPl ? "Wesprzyj projekt" : "Back this project"}
              </a>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sp-muted)]">
                <ShieldCheck size={13} className="text-[var(--sp-gold)]" aria-hidden="true" />
                {isPl ? "Jednorazowa wpłata · Stripe" : "One-time pledge · Stripe"}
              </p>
            </aside>
          </div>
        </section>

        {/* ── About / story ────────────────────────────────────────────── */}
        <section id="projekt" className="scroll-mt-24 pt-20 lg:pt-28">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--sp-gold)]">
            {isPl ? "O projekcie" : "About the project"}
          </p>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="font-brand text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[var(--sp-ink)] sm:text-[36px]">
                {isPl ? "Coś się szykuje. Nie mogę jeszcze powiedzieć co." : "Something is coming. I can't say what yet."}
              </h2>
            </div>
            <div className="space-y-5 text-[15.5px] leading-relaxed text-[var(--sp-body)] lg:col-span-7">
              <p>
                {isPl
                  ? "Od miesięcy pracuję nad czymś, co wykracza poza wszystko, co do tej pory pojawiło się na kanale. Projekt jest na etapie, w którym potrzebuje jednego: paliwa, żeby dowieźć go do końca w pełnej jakości — bez kompromisów i bez skracania drogi."
                  : "For months I've been working on something that goes beyond anything the channel has published so far. The project is at the stage where it needs one thing: fuel to carry it across the finish line at full quality — no compromises, no shortcuts."}
              </p>
              <p>
                {isPl
                  ? "Dlaczego sekret? Bo część siły tego projektu tkwi w zaskoczeniu. Zamiast obiecywać, pokazuję: zapowiedź na górze strony to przedsmak, a tajny materiał dla wspierających uchyla kulisy szerzej niż cokolwiek publicznego."
                  : "Why a secret? Because part of this project's power lies in the surprise. Instead of promising, I show: the teaser above is a taste, and the backers-only secret material opens the curtain wider than anything public."}
              </p>
              <p>
                {isPl
                  ? "Każda wpłata trafia bezpośrednio w produkcję. Ty dostajesz dożywotni dostęp do tajnego materiału i Strefy Fenkjuu — ja dostaję możliwość zrobienia tego porządnie. Umowa prosta jak pasek postępu powyżej."
                  : "Every pledge goes straight into production. You get lifetime access to the secret material and the Thank You Zone — I get the means to do this properly. A deal as simple as the progress bar above."}
              </p>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className={`${styles.panel} rounded-[22px] p-6`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--sp-line-strong)] bg-black/25 text-[var(--sp-gold)]">
                  <feature.icon size={20} strokeWidth={2.2} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-brand text-[17px] font-extrabold tracking-[-0.02em] text-[var(--sp-ink)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--sp-body)]">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Reward ───────────────────────────────────────────────────── */}
        <section id="nagroda" className="scroll-mt-24 pt-20 lg:pt-28">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--sp-gold)]">
            {isPl ? "Nagroda za wsparcie" : "Backer reward"}
          </p>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <h2 className="font-brand text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[var(--sp-ink)] sm:text-[36px]">
                {isPl ? "Tajny film. Tylko dla wspierających." : "The secret video. Backers only."}
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--sp-body)]">
                {viewerIsPatron
                  ? (isPl
                      ? "Masz aktywny dostęp wspierającego — tajny materiał obok jest odblokowany i gotowy do odtworzenia. Dziękuję, że jesteś częścią tego projektu."
                      : "Your backer access is active — the secret material next to this is unlocked and ready to play. Thank you for being part of this project.")
                  : (isPl
                      ? "Materiał obok jest zablokowany do momentu wsparcia kampanii. Jedna wpłata odblokowuje go natychmiast i dożywotnio — razem z całą Strefą Fenkjuu."
                      : "The material next to this stays locked until you back the campaign. One pledge unlocks it instantly and for life — along with the whole Thank You Zone.")}
              </p>
              <ul className="mt-6 space-y-3 text-[14px] text-[var(--sp-body)]">
                {[
                  isPl ? "Natychmiastowe odblokowanie po wpłacie" : "Instant unlock after your pledge",
                  isPl ? "Dożywotni dostęp — bez abonamentu" : "Lifetime access — no subscription",
                  isPl ? "Pełna Strefa Fenkjuu w pakiecie" : "The full Thank You Zone included",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--sp-gold)] text-[9px] font-black text-[var(--sp-gold-ink)]">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:col-span-7">
              <div className={`${styles.videoGlow} relative aspect-video w-full overflow-hidden rounded-[22px] bg-black`}>
                {rewardVideo ? (
                  <PremiumWrapper videoId={rewardVideo.id} requiredTier={rewardVideo.tier}>
                    <VideoPlayer video={rewardVideo} />
                  </PremiumWrapper>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[var(--sp-muted)]">
                    <Lock size={40} aria-hidden="true" />
                    <p className="text-sm font-semibold">
                      {isPl ? "Tajny materiał zostanie ujawniony wkrótce" : "The secret material will be revealed soon"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── Pledge ───────────────────────────────────────────────────── */}
        <section className="pt-20 lg:pt-28">
          <SecretPledgeBox viewerIsPatron={viewerIsPatron} />
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-24 pt-20 lg:pt-28">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.26em] text-[var(--sp-gold)]">FAQ</p>
          <h2 className="font-brand text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[var(--sp-ink)] sm:text-[36px]">
            {isPl ? "Pytania i odpowiedzi" : "Questions & answers"}
          </h2>
          <div className="mt-8 space-y-3">
            {faq.map((item) => (
              <details key={item.q} className={`${styles.faqItem} ${styles.panel} group rounded-[18px] px-6 py-5`}>
                <summary className="flex items-center justify-between gap-4 font-brand text-[16px] font-bold tracking-[-0.01em] text-[var(--sp-ink)]">
                  {item.q}
                  <ChevronDown size={18} className={`${styles.faqChevron} shrink-0 text-[var(--sp-muted)]`} aria-hidden="true" />
                </summary>
                <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-[var(--sp-body)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--sp-line)]">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-4 py-8 text-[12.5px] text-[var(--sp-muted)] sm:flex-row md:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Secret Project · polutek.pl</p>
          <nav className="flex items-center gap-5" aria-label={isPl ? "Linki prawne" : "Legal links"}>
            <Link href="/" className="transition-colors hover:text-[var(--sp-ink)]">
              {isPl ? "Strona główna" : "Home"}
            </Link>
            <Link href={isPl ? "/regulamin" : "/en/terms"} className="transition-colors hover:text-[var(--sp-ink)]">
              {isPl ? "Regulamin" : "Terms"}
            </Link>
            <Link href={isPl ? "/polityka-prywatnosci" : "/en/privacy-policy"} className="transition-colors hover:text-[var(--sp-ink)]">
              {isPl ? "Polityka prywatności" : "Privacy policy"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
