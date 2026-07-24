"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Clock,
  Infinity as InfinityIcon,
  Lock,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { PublicVideoDTO } from "@/app/types/video";
import type { SecretProjectFunding } from "@/lib/modules/campaign/secret-project-funding";
import PremiumWrapper from "../PremiumWrapper";
import VideoPlayer from "../VideoPlayer";
import { useAuthModal } from "../auth/AuthModalProvider";
import { useLanguage } from "../LanguageContext";
import SecretPledgeBox2 from "./SecretPledgeBox2";
import styles from "./SecretProject2.module.css";

interface SecretProject2ExperienceProps {
  pitchVideo: PublicVideoDTO | null;
  rewardVideo: PublicVideoDTO | null;
  funding: SecretProjectFunding;
  viewerIsPatron: boolean;
}

const PROJECT_TITLE = "I raise money for my secret project";

function formatAmount(value: number, isPl: boolean): string {
  return Math.floor(value).toLocaleString(isPl ? "pl-PL" : "en-US");
}

/** Scroll-reveal wrapper shared across sections — the page's animation technique
 * is framer-motion's viewport-triggered variants rather than CSS keyframes. */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const variants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 22 }, visible: { opacity: 1, y: 0 } };

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Circular SVG funding ring — the "different technique" progress indicator
 * versus the linear CSS bar used on /secretproject. */
function FundingRing({ percent }: { percent: number }) {
  const prefersReducedMotion = useReducedMotion();
  const size = 168;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(clamped)}%`}>
      <circle className={styles.ringTrack} cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} />
      <motion.circle
        className={styles.ringFill}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: prefersReducedMotion ? 0 : 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export default function SecretProject2Experience({
  pitchVideo,
  rewardVideo,
  funding,
  viewerIsPatron,
}: SecretProject2ExperienceProps) {
  const { language } = useLanguage();
  const isPl = language === "pl";
  const { isSignedIn } = useAuth();
  const { open: openAuthModal } = useAuthModal();

  const percent = funding.goalPln > 0 ? Math.min(100, (funding.raisedPln / funding.goalPln) * 100) : 0;
  const daysLeft = Math.max(0, funding.daysLeft);

  const nav = [
    { href: "#projekt", label: isPl ? "O projekcie" : "About" },
    { href: "#nagroda", label: isPl ? "Nagroda" : "Reward" },
    { href: "#faq", label: "FAQ" },
  ];

  const notes = [
    {
      n: "01",
      title: isPl ? "Tajny materiał" : "Secret material",
      body: isPl
        ? "Dodatkowy film dostępny wyłącznie dla wspierających. Nie trafi nigdzie indziej."
        : "An extra video available exclusively to backers. It won't appear anywhere else.",
    },
    {
      n: "02",
      title: isPl ? "Bez abonamentu" : "No subscription",
      body: isPl
        ? "Jedna wpłata, dostęp na zawsze. Żadnych odnowień ani ukrytych opłat."
        : "One pledge, access forever. No renewals or hidden fees.",
    },
    {
      n: "03",
      title: isPl ? "Realny wpływ" : "Real impact",
      body: isPl
        ? "Każda wpłata bezpośrednio zasila produkcję i przesuwa wskaźnik postępu."
        : "Every pledge directly funds production and moves the progress indicator.",
    },
  ];

  const faq = [
    {
      q: isPl ? "Co dokładnie wspieram?" : "What exactly am I backing?",
      a: isPl
        ? "Tajny projekt ujawniany etapami. Zapowiedź powyżej pokazuje kierunek — reszta zostaje niespodzianką do premiery."
        : "A secret project revealed in stages. The teaser above shows the direction — the rest stays a surprise until launch.",
    },
    {
      q: isPl ? "Co otrzymuję za wsparcie?" : "What do I get for backing?",
      a: isPl
        ? "Natychmiastowy, dożywotni dostęp do tajnego filmu oraz do całej Strefy Fenkjuu."
        : "Immediate, lifetime access to the secret video and the whole Thank You Zone.",
    },
    {
      q: isPl ? "Czy to abonament?" : "Is this a subscription?",
      a: isPl
        ? "Nie. Jednorazowa wpłata — nic się nie odnawia, a dostęp pozostaje aktywny na zawsze."
        : "No. A one-time pledge — nothing renews, and access stays active forever.",
    },
    {
      q: isPl ? "Jak obsługiwane są płatności?" : "How are payments handled?",
      a: isPl
        ? "Płatności obsługuje Stripe. Nie przechowujemy danych Twojej karty."
        : "Payments are handled by Stripe. We never store your card details.",
    },
    {
      q: isPl ? "Co jeśli kampania nie osiągnie celu?" : "What if the campaign doesn't reach its goal?",
      a: isPl
        ? "Twój dostęp pozostaje aktywny niezależnie od wyniku kampanii — odblokowuje się od razu po wpłacie."
        : "Your access stays active regardless of the campaign outcome — it unlocks immediately after your pledge.",
    },
  ];

  return (
    <div className={`${styles.sp2} min-h-screen scroll-smooth font-sans`}>
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-[var(--sp2-line)] bg-[rgba(250,249,246,0.86)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
          <a href="#top" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-[var(--sp2-ink)]">
              <Sparkles size={14} strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="truncate font-brand text-[14px] font-extrabold uppercase tracking-[0.2em] text-[var(--sp2-ink)]">
              Secret Project
            </span>
          </a>

          <nav className="hidden items-center gap-7 md:flex" aria-label={isPl ? "Nawigacja kampanii" : "Campaign navigation"}>
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[13px] font-semibold tracking-[0.02em] text-[var(--sp2-muted)] transition-colors hover:text-[var(--sp2-ink)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <span className="hidden items-center gap-2 rounded-full border border-[var(--sp2-line-strong)] px-3 py-1.5 text-[12px] font-bold tabular-nums text-[var(--sp2-ink)] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--sp2-accent)]" aria-hidden="true" />
              {Math.round(percent)}%
            </span>
            {!isSignedIn && (
              <button
                type="button"
                onClick={() => openAuthModal("sign-in")}
                className="hidden h-10 items-center rounded-[10px] border border-[var(--sp2-line-strong)] px-4 text-[13px] font-bold text-[var(--sp2-ink)] transition-colors hover:border-[var(--sp2-ink)] sm:flex"
              >
                {isPl ? "Zaloguj się" : "Sign in"}
              </button>
            )}
            <a
              href="#wesprzyj"
              className={`${styles.ctaAccent} flex h-10 items-center rounded-[10px] px-5 font-brand text-[13px] font-extrabold tracking-[-0.01em]`}
            >
              {isPl ? "Wesprzyj" : "Back it"}
            </a>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1180px] px-4 pb-24 md:px-6 lg:px-8">
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-10 pt-14 lg:grid-cols-12 lg:items-start lg:gap-8 lg:pt-20">
          <div className="lg:col-span-7">
            <p className={`${styles.kicker} mb-5 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--sp2-muted)]`}>
              {isPl ? "Kampania crowdfundingowa" : "Crowdfunding campaign"}
            </p>

            <h1 className="max-w-2xl font-brand text-[34px] font-extrabold leading-[1.06] tracking-[-0.035em] text-[var(--sp2-ink)] sm:text-[44px] lg:text-[52px]">
              {PROJECT_TITLE.split(" secret ")[0]}{" "}
              <span className="relative inline-block">
                <span className="relative z-10">secret</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-3 -rotate-1 bg-[var(--sp2-accent-soft)]" />
              </span>{" "}
              {PROJECT_TITLE.split(" secret ")[1]}
            </h1>

            <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-[var(--sp2-body)]">
              {isPl
                ? "Zbieram środki na projekt, o którym na razie nie mogę powiedzieć wszystkiego. Obejrzyj zapowiedź, wesprzyj kampanię jednorazową wpłatą i odblokuj tajny materiał dostępny wyłącznie dla wspierających."
                : "I'm raising funds for a project I can't fully talk about yet. Watch the teaser, back the campaign with a one-time pledge, and unlock the secret material available exclusively to backers."}
            </p>

            <div className="mt-8 aspect-video w-full overflow-hidden rounded-[20px] border border-[var(--sp2-line)] bg-black shadow-[0_30px_60px_-32px_rgba(23,22,15,0.35)]">
              {pitchVideo ? (
                <PremiumWrapper videoId={pitchVideo.id} requiredTier={pitchVideo.tier}>
                  <VideoPlayer video={pitchVideo} />
                </PremiumWrapper>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/60">
                  <Play size={40} aria-hidden="true" />
                  <p className="text-sm font-semibold">
                    {isPl ? "Zapowiedź pojawi się wkrótce" : "The teaser is coming soon"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Funding panel */}
          <aside className={`${styles.card} rounded-[24px] p-6 sm:p-7 lg:sticky lg:top-24 lg:col-span-5`} aria-label={isPl ? "Postęp zbiórki" : "Funding progress"}>
            <div className="flex items-center gap-6">
              <div className="relative shrink-0">
                <FundingRing percent={percent} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-brand text-[26px] font-extrabold tabular-nums text-[var(--sp2-ink)]">
                    {Math.round(percent)}%
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--sp2-muted)]">
                    {isPl ? "celu" : "funded"}
                  </span>
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-brand text-[28px] font-extrabold leading-none tracking-[-0.02em] text-[var(--sp2-ink)] tabular-nums">
                  {formatAmount(funding.raisedPln, isPl)} zł
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-[var(--sp2-muted)]">
                  {isPl
                    ? `z celu ${formatAmount(funding.goalPln, isPl)} zł`
                    : `of the ${formatAmount(funding.goalPln, isPl)} zł goal`}
                </p>
              </div>
            </div>

            <dl className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-[var(--sp2-line)] bg-[var(--sp2-bg)] px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--sp2-muted)]">
                  <Users size={12} aria-hidden="true" />
                  {isPl ? "Wspierających" : "Backers"}
                </dt>
                <dd className="mt-1 font-brand text-[20px] font-extrabold tabular-nums text-[var(--sp2-ink)]">
                  {funding.backers.toLocaleString(isPl ? "pl-PL" : "en-US")}
                </dd>
              </div>
              <div className="rounded-[14px] border border-[var(--sp2-line)] bg-[var(--sp2-bg)] px-4 py-3">
                <dt className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--sp2-muted)]">
                  <Clock size={12} aria-hidden="true" />
                  {isPl ? "Dni do końca" : "Days left"}
                </dt>
                <dd className="mt-1 font-brand text-[20px] font-extrabold tabular-nums text-[var(--sp2-ink)]">
                  {daysLeft}
                </dd>
              </div>
            </dl>

            <a
              href="#wesprzyj"
              className={`${styles.ctaAccent} mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] font-brand text-[15px] font-extrabold tracking-[-0.01em]`}
            >
              {isPl ? "Wesprzyj projekt" : "Back this project"}
            </a>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--sp2-muted)]">
              <ShieldCheck size={13} className="text-[var(--sp2-accent)]" aria-hidden="true" />
              {isPl ? "Jednorazowa wpłata · Stripe" : "One-time pledge · Stripe"}
            </p>
          </aside>
        </section>

        {/* ── About / editorial notes ──────────────────────────────────── */}
        <section id="projekt" className="scroll-mt-24 pt-24 lg:pt-32">
          <Reveal>
            <p className={`${styles.kicker} mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--sp2-muted)]`}>
              {isPl ? "O projekcie" : "About the project"}
            </p>
          </Reveal>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <Reveal delay={0.05} className="lg:col-span-5">
              <blockquote className="border-l-2 border-[var(--sp2-accent)] pl-5 font-brand text-[24px] font-extrabold leading-[1.28] tracking-[-0.02em] text-[var(--sp2-ink)] sm:text-[28px]">
                {isPl
                  ? "„Coś się szykuje. Nie mogę jeszcze powiedzieć co — ale mogę pokazać, że jest realne.”"
                  : "“Something is coming. I can't say what yet — but I can show you it's real.”"}
              </blockquote>
            </Reveal>
            <Reveal delay={0.12} className="space-y-5 text-[15.5px] leading-relaxed text-[var(--sp2-body)] lg:col-span-7">
              <p>
                {isPl
                  ? "Od miesięcy pracuję nad czymś, co wykracza poza wszystko, co do tej pory pojawiło się na kanale. Projekt jest na etapie, w którym potrzebuje jednego: paliwa, żeby dowieźć go do końca w pełnej jakości."
                  : "For months I've been working on something that goes beyond anything the channel has published so far. The project needs one thing: fuel to carry it across the finish line at full quality."}
              </p>
              <p>
                {isPl
                  ? "Każda wpłata trafia bezpośrednio w produkcję. Ty dostajesz dożywotni dostęp do tajnego materiału i Strefy Fenkjuu — ja dostaję możliwość zrobienia tego porządnie."
                  : "Every pledge goes straight into production. You get lifetime access to the secret material and the Thank You Zone — I get the means to do this properly."}
              </p>
            </Reveal>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {notes.map((note, index) => (
              <Reveal key={note.n} delay={index * 0.08}>
                <div className="border-t border-[var(--sp2-line-strong)] pt-4">
                  <span className="font-mono text-[12px] font-bold text-[var(--sp2-accent)]">{note.n}</span>
                  <h3 className="mt-2 font-brand text-[17px] font-extrabold tracking-[-0.02em] text-[var(--sp2-ink)]">
                    {note.title}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--sp2-body)]">{note.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Reward ───────────────────────────────────────────────────── */}
        <section id="nagroda" className="scroll-mt-24 pt-24 lg:pt-32">
          <Reveal>
            <p className={`${styles.kicker} mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--sp2-muted)]`}>
              {isPl ? "Nagroda za wsparcie" : "Backer reward"}
            </p>
          </Reveal>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
            <Reveal delay={0.05} className="lg:col-span-5">
              <h2 className="font-brand text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[var(--sp2-ink)] sm:text-[34px]">
                {isPl ? "Tajny film. Tylko dla wspierających." : "The secret video. Backers only."}
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-[var(--sp2-body)]">
                {viewerIsPatron
                  ? (isPl
                      ? "Masz aktywny dostęp wspierającego — tajny materiał obok jest odblokowany i gotowy do odtworzenia."
                      : "Your backer access is active — the secret material next to this is unlocked and ready to play.")
                  : (isPl
                      ? "Materiał obok jest zablokowany do momentu wsparcia kampanii. Jedna wpłata odblokowuje go natychmiast i dożywotnio."
                      : "The material next to this stays locked until you back the campaign. One pledge unlocks it instantly and for life.")}
              </p>
              <ul className="mt-6 space-y-3 text-[14px] text-[var(--sp2-body)]">
                {[
                  isPl ? "Natychmiastowe odblokowanie po wpłacie" : "Instant unlock after your pledge",
                  isPl ? "Dożywotni dostęp — bez abonamentu" : "Lifetime access — no subscription",
                  isPl ? "Pełna Strefa Fenkjuu w pakiecie" : "The full Thank You Zone included",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <InfinityIcon size={16} strokeWidth={2.2} className="mt-[2px] shrink-0 text-[var(--sp2-accent)]" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.12} className="lg:col-span-7">
              <div className="relative aspect-video w-full overflow-hidden rounded-[20px] border border-[var(--sp2-line)] bg-black shadow-[0_30px_60px_-32px_rgba(23,22,15,0.35)]">
                {rewardVideo ? (
                  <PremiumWrapper videoId={rewardVideo.id} requiredTier={rewardVideo.tier}>
                    <VideoPlayer video={rewardVideo} />
                  </PremiumWrapper>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/60">
                    <Lock size={40} aria-hidden="true" />
                    <p className="text-sm font-semibold">
                      {isPl ? "Tajny materiał zostanie ujawniony wkrótce" : "The secret material will be revealed soon"}
                    </p>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Pledge ───────────────────────────────────────────────────── */}
        <section className="pt-24 lg:pt-32">
          <Reveal>
            <SecretPledgeBox2 viewerIsPatron={viewerIsPatron} />
          </Reveal>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-24 pt-24 lg:pt-32">
          <Reveal>
            <p className={`${styles.kicker} mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--sp2-muted)]`}>
              FAQ
            </p>
            <h2 className="font-brand text-[28px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[var(--sp2-ink)] sm:text-[34px]">
              {isPl ? "Pytania i odpowiedzi" : "Questions & answers"}
            </h2>
          </Reveal>
          <div className="mt-8 divide-y divide-[var(--sp2-line)] border-t border-[var(--sp2-line)]">
            {faq.map((item) => (
              <details key={item.q} className={`${styles.faqToggle} group py-5`}>
                <summary className="flex items-center justify-between gap-4 font-brand text-[16px] font-bold tracking-[-0.01em] text-[var(--sp2-ink)]">
                  {item.q}
                  <span className={styles.faqPlus} aria-hidden="true" />
                </summary>
                <p className="mt-3 max-w-3xl text-[14.5px] leading-relaxed text-[var(--sp2-body)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--sp2-line)]">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center justify-between gap-4 px-4 py-8 text-[12.5px] text-[var(--sp2-muted)] sm:flex-row md:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} Secret Project · polutek.pl</p>
          <nav className="flex items-center gap-5" aria-label={isPl ? "Linki prawne" : "Legal links"}>
            <Link href="/" className="transition-colors hover:text-[var(--sp2-ink)]">
              {isPl ? "Strona główna" : "Home"}
            </Link>
            <Link href={isPl ? "/regulamin" : "/en/terms"} className="transition-colors hover:text-[var(--sp2-ink)]">
              {isPl ? "Regulamin" : "Terms"}
            </Link>
            <Link href={isPl ? "/polityka-prywatnosci" : "/en/privacy-policy"} className="transition-colors hover:text-[var(--sp2-ink)]">
              {isPl ? "Polityka prywatności" : "Privacy policy"}
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
