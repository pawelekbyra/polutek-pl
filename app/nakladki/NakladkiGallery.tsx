"use client";

import React, { useState } from "react";
import {
  Star,
  Gem,
  Lock,
  Ticket,
  Radar,
  Compass,
  Sparkles,
  ShieldCheck,
  Stamp,
  Scissors,
  Orbit,
  PenTool,
  Sun,
  KeyRound,
  CreditCard,
  BookOpen,
  Radio,
  Droplets,
  Box,
  Flame,
  Cpu,
} from "lucide-react";
import AccessLockOverlay from "@/app/components/AccessLockOverlay";
import { cn } from "@/lib/utils";
import styles from "./nakladki.module.css";

type Mode = "LOGIN_REQUIRED" | "PATRON_REQUIRED";

const COPY = {
  LOGIN_REQUIRED: {
    kicker: "Strefa zalogowanych",
    title: "Zaloguj się",
    titleAccent: "aby oglądać",
    body: "Ten materiał jest dostępny wyłącznie dla zalogowanych widzów.",
    cta: "Zaloguj się",
    tag: "Dostęp: zalogowani",
  },
  PATRON_REQUIRED: {
    kicker: "Strefa Fenkju",
    title: "Zostań",
    titleAccent: "Patronem",
    body: "Ten materiał odblokowuje się jednorazowym wsparciem projektu — na zawsze.",
    cta: "Zostań Patronem",
    tag: "Dostęp: Patron",
  },
} as const;

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--chan-line)] bg-[var(--chan-card)] p-1 text-[11px] font-bold uppercase tracking-[0.08em]">
      {(["LOGIN_REQUIRED", "PATRON_REQUIRED"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            mode === m
              ? m === "PATRON_REQUIRED"
                ? "bg-[var(--chan-amber-soft)] text-[var(--chan-amber-strong)]"
                : "bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]"
              : "text-[var(--chan-muted)] hover:text-[var(--chan-ink)]",
          )}
        >
          {m === "LOGIN_REQUIRED" ? "Niezalogowany" : "Nie-patron"}
        </button>
      ))}
    </div>
  );
}

function ConceptCard({
  index,
  title,
  description,
  tag,
  children,
}: {
  index: number;
  title: string;
  description: string;
  tag: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[24px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_92%,white)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_-24px_rgba(23,23,23,0.2)] md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--chan-blue)]">
            {String(index).padStart(2, "0")} · {tag}
          </span>
          <h3 className="mt-1 font-brand text-lg font-bold text-[var(--chan-ink)] md:text-xl">
            {title}
          </h3>
          <p className="mt-1 max-w-[52ch] text-sm text-[var(--chan-muted)]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* 1. Aurora Premium — real production component, shown as baseline reference */
function ConceptAuroraPremium({ mode }: { mode: Mode }) {
  return <AccessLockOverlay state={mode} variant="default" />;
}

/* 2. Frosted Glass Editorial */
function ConceptGlass({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.glass, isPatron ? styles.patron : styles.login)}>
        <div className={styles.glassPanel}>
          <span className={styles.glassBadge}>{isPatron ? <Gem /> : <Star />}</span>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-white/70">{c.kicker}</p>
          <h4 className="text-2xl font-extrabold uppercase tracking-tight text-white">
            {c.title} <span className="opacity-80">{c.titleAccent}</span>
          </h4>
          <p className="max-w-[30ch] text-xs text-white/70">{c.body}</p>
          <span className="mt-2 border-b border-white/50 pb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            {c.cta}
          </span>
        </div>
      </div>
    </div>
  );
}

/* 3. Neubrutalism Block */
function ConceptBrutalism({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.brut, isPatron ? styles.patron : styles.login)}>
        <div className={cn(styles.brutCard, isPatron && styles.patronCard)}>
          <span className={cn(styles.brutBadge, isPatron && styles.patronBadge)}>
            {isPatron ? <Gem /> : <Lock />}
          </span>
          <h4 className="text-xl font-black uppercase tracking-tight text-[#111827]">
            {c.title} {c.titleAccent}
          </h4>
          <p className="max-w-[28ch] text-center text-xs font-medium text-[#475467]">{c.body}</p>
          <button type="button" className={cn(styles.brutCta, isPatron && styles.patronBtn)}>
            {c.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

/* 4. Cinematic Letterbox */
function ConceptCinematic({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={styles.cine}>
        <div className={cn(styles.cineBar, styles.top)} />
        <div className={cn(styles.cineBar, styles.bottom)} />
        <div className={styles.cineGrain} />
        <div className={styles.cineContent}>
          {isPatron ? <Gem size={30} /> : <Star size={30} />}
          <span className={styles.cineKicker}>{c.kicker}</span>
          <h4 className={styles.cineTitle}>
            {c.title}{" "}
            <span className={isPatron ? styles.accentPatron : styles.accentLogin}>
              {c.titleAccent}
            </span>
          </h4>
          <span className={styles.cineRule} />
          <span className={styles.cineCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 5. Editorial Paywall */
function ConceptEditorial({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={styles.editorial}>
        <div className={styles.editorialCard}>
          <span className={cn(styles.editorialKicker, !isPatron && styles.loginKicker)}>
            {c.kicker}
          </span>
          <div className={styles.editorialRule} />
          <h4 className={styles.editorialHeadline}>
            {c.title} {c.titleAccent}
          </h4>
          <p className={styles.editorialBody}>{c.body}</p>
          <div className={styles.editorialRule} />
          <span className={styles.editorialCta}>{c.cta} →</span>
        </div>
      </div>
    </div>
  );
}

/* 6. Ticket Stub */
function ConceptTicket({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.ticket, isPatron ? styles.patron : styles.login)}>
        <div className={styles.ticketBody}>
          <div className={styles.ticketMain}>
            <span className={styles.ticketKicker}>{c.tag}</span>
            <span className={styles.ticketTitle}>
              {c.title} {c.titleAccent}
            </span>
            <div className={styles.ticketBarcode} aria-hidden="true">
              {Array.from({ length: 24 }).map((_, i) => (
                <span key={i} style={{ height: `${6 + ((i * 7) % 10)}px` }} />
              ))}
            </div>
            <span className={cn(styles.ticketCta, isPatron && styles.patronCta)}>{c.cta} →</span>
          </div>
          <div className={styles.ticketDivider}>
            <span className={styles.ticketNotch} style={{ top: -9 }} />
            <span className={styles.ticketNotch} style={{ bottom: -9, top: "auto" }} />
          </div>
          <div className={cn(styles.ticketStub, isPatron ? styles.patronStub : styles.loginStub)}>
            {isPatron ? <Gem /> : <Ticket />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 7. HUD Scanner */
function ConceptHud({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.hud, isPatron && styles.patron)}>
        <div className={styles.hudScan} />
        <div className={styles.hudBox}>
          <span className={cn(styles.hudCorner, styles.tl)} />
          <span className={cn(styles.hudCorner, styles.tr)} />
          <span className={cn(styles.hudCorner, styles.bl)} />
          <span className={cn(styles.hudCorner, styles.br)} />
          {isPatron ? <Radar className={styles.hudIcon} /> : <Compass className={styles.hudIcon} />}
          <span className={styles.hudTag}>{c.tag}</span>
          <h4 className={styles.hudTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.hudCta}>▸ {c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 8. Liquid Blob Morph */
function ConceptLiquid({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={styles.liquid}>
        <span className={cn(styles.liquidBlob, isPatron ? styles.patron : styles.login)} />
        <div className={styles.liquidContent}>
          {isPatron ? <Sparkles className={styles.liquidIcon} /> : <Star className={styles.liquidIcon} />}
          <h4 className={styles.liquidTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.liquidCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 9. Blueprint Technical */
function ConceptBlueprint({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.blue, isPatron && styles.patron)}>
        <div className={styles.blueContent}>
          <div className={styles.blueTarget}>
            {isPatron ? <Gem className={styles.blueIcon} /> : <ShieldCheck className={styles.blueIcon} />}
          </div>
          <span className={styles.blueLabel}>{c.tag}</span>
          <h4 className={styles.blueTitle}>
            {c.title} <strong>{c.titleAccent}</strong>
          </h4>
          <span className={styles.blueCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 10. Marquee Ticker */
function ConceptMarquee({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  const word = isPatron ? "PATRON • " : "ZALOGUJ SIĘ • ";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.marquee, isPatron ? styles.patron : styles.login)}>
        <div className={cn(styles.marqueeRow, styles.top)} aria-hidden="true">
          <span>{word.repeat(6)}</span>
          <span>{word.repeat(6)}</span>
        </div>
        <div className={cn(styles.marqueeRow, styles.bottom)} aria-hidden="true">
          <span>{word.repeat(6)}</span>
          <span>{word.repeat(6)}</span>
        </div>
        <div className={styles.marqueeContent}>
          <span className={styles.marqueeBadge}>{isPatron ? <Gem /> : <Lock />}</span>
          <h4 className={styles.marqueeTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.marqueeCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 11. Wax Seal / Envelope */
function ConceptWax({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.wax, isPatron && styles.patron)}>
        <div className={styles.waxEnvelope}>
          <span className={styles.waxSeal}>{isPatron ? <Gem /> : <Stamp />}</span>
          <span className={styles.waxKicker}>{c.kicker}</span>
          <h4 className={styles.waxTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.waxCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 12. Holographic Foil */
function ConceptHolo({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={styles.holo}>
        <div className={styles.holoCard}>
          {isPatron ? <Gem className={styles.holoBadge} /> : <Sparkles className={styles.holoBadge} />}
          <h4 className={styles.holoTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.holoCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 13. Origami Paper Fold */
function ConceptOrigami({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.origami, isPatron && styles.patron)}>
        <div className={styles.origamiFold} aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className={styles.origamiContent}>
          {isPatron ? <Gem size={30} /> : <Scissors size={30} />}
          <h4 className={styles.origamiTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.origamiCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 14. Retro Terminal */
function ConceptTerminal({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.term, isPatron && styles.patron)}>
        <div className={styles.termGlow} />
        <div className={styles.termScan} />
        <div className={styles.termBox}>
          <span className={styles.termLine}>&gt; whoami</span>
          <span className={styles.termLine}>&gt; access_level: {isPatron ? "GUEST" : "ANONYMOUS"}</span>
          <h4 className={styles.termTitle}>
            {c.title} {c.titleAccent}
            <span className={styles.termCursor} aria-hidden="true" />
          </h4>
          <span className={styles.termLine}>&gt; {c.cta.toLowerCase()}_</span>
        </div>
      </div>
    </div>
  );
}

/* 15. Constellation */
function ConceptConstellation({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  const dots = [
    [12, 18], [28, 10], [42, 24], [18, 46], [64, 14], [78, 32], [58, 52], [86, 58], [34, 66], [70, 74], [10, 78], [92, 20],
  ];
  return (
    <div className={styles.frame}>
      <div className={cn(styles.constellation, isPatron && styles.patron)}>
        {dots.map(([x, y], i) => (
          <span
            key={i}
            className={styles.constDot}
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.3}s` }}
            aria-hidden="true"
          />
        ))}
        <div className={styles.constContent}>
          {isPatron ? <Sparkles className={styles.constIcon} /> : <Orbit className={styles.constIcon} />}
          <h4 className={styles.constTitle}>
            {c.title} <strong>{c.titleAccent}</strong>
          </h4>
          <span className={styles.constCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 16. Hand-drawn Sketch */
function ConceptSketch({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.sketch, isPatron && styles.patron)}>
        <div className={styles.sketchCard}>
          {isPatron ? <Gem className={styles.sketchIcon} /> : <PenTool className={styles.sketchIcon} />}
          <h4 className={styles.sketchTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.sketchCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 17. Vaporwave Grid */
function ConceptVaporwave({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.vapor, isPatron && styles.patron)}>
        <span className={styles.vaporSun} aria-hidden="true" />
        <span className={styles.vaporGrid} aria-hidden="true" />
        <div className={styles.vaporContent}>
          <h4 className={styles.vaporTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.vaporCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 18. Newspaper Classified */
function ConceptClassified({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.classified, isPatron && styles.patron)}>
        <div className={styles.classifiedBox}>
          <span className={styles.classifiedKicker}>{c.tag}</span>
          <h4 className={styles.classifiedTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.classifiedStamp}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 19. Membership Card */
function ConceptCard3D({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.card3d, isPatron && styles.patron)}>
        <div className={styles.cardBody}>
          <div className={styles.cardChip} aria-hidden="true" />
          <h4 className={styles.cardTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <div className={styles.cardMeta}>
            <span>{c.tag}</span>
            {isPatron ? <Gem size={16} /> : <CreditCard size={16} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* 20. Popup Book Layers */
function ConceptPopup({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.popup, isPatron && styles.patron)}>
        <span className={cn(styles.popupLayer, styles.back)} aria-hidden="true" />
        <span className={cn(styles.popupLayer, styles.mid)} aria-hidden="true" />
        <div className={styles.popupContent}>
          {isPatron ? <Gem size={28} /> : <BookOpen size={28} />}
          <h4 className={styles.popupTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.popupCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 21. Radial Sunburst */
function ConceptSunburst({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.sunburst, isPatron && styles.patron)}>
        <span className={styles.sunburstRays} aria-hidden="true" />
        <span className={styles.sunburstBadge}>{isPatron ? <Gem /> : <Sun />}</span>
        <div className={styles.sunburstContent}>
          <h4 className={styles.sunburstTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.sunburstCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 22. Morse Signal */
function ConceptMorse({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.morse, isPatron && styles.patron)}>
        <div className={styles.morseContent}>
          <div className={styles.morseRow} aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
          <span className={styles.morseDot} aria-hidden="true" />
          {isPatron ? <Gem size={26} /> : <Radio size={26} />}
          <h4 className={styles.morseTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.morseCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 23. Watercolor Wash */
function ConceptWatercolor({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.water, isPatron && styles.patron)}>
        <span className={cn(styles.waterBlob, styles.b1)} aria-hidden="true" />
        <span className={cn(styles.waterBlob, styles.b2)} aria-hidden="true" />
        <span className={cn(styles.waterBlob, styles.b3)} aria-hidden="true" />
        <div className={styles.waterContent}>
          {isPatron ? <Droplets className={styles.waterIcon} /> : <Droplets className={styles.waterIcon} />}
          <h4 className={styles.waterTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.waterCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 24. Wireframe Cube */
function ConceptWireframe({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.wire, isPatron && styles.patron)}>
        <div className={styles.wireContent}>
          <div className={styles.wireCube} aria-hidden="true">
            <span className={cn(styles.wireFace, styles.f1)} />
            <span className={cn(styles.wireFace, styles.f2)} />
            <span className={cn(styles.wireFace, styles.f3)} />
          </div>
          <h4 className={styles.wireTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.wireCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 25. Torn Paper Edge */
function ConceptTorn({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.torn, isPatron && styles.patron)}>
        <div className={styles.tornCard}>
          {isPatron ? <Gem /> : <Box />}
          <h4 className={styles.tornTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.tornCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 26. Neon Sign */
function ConceptNeon({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.neon, isPatron && styles.patron)}>
        <div className={styles.neonContent}>
          {isPatron ? <Gem className={styles.neonIcon} /> : <Sparkles className={styles.neonIcon} />}
          <h4 className={styles.neonTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.neonCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 27. Stained Glass Mosaic */
function ConceptMosaic({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.glassMosaic, isPatron && styles.patron)}>
        <span className={styles.mosaicTile} aria-hidden="true" />
        <span className={styles.mosaicTile} aria-hidden="true" />
        <span className={styles.mosaicTile} aria-hidden="true" />
        <span className={styles.mosaicTile} aria-hidden="true" />
        <div className={styles.mosaicContent}>
          {isPatron ? <Gem size={28} /> : <KeyRound size={28} />}
          <h4 className={styles.mosaicTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.mosaicCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 28. Candlelit Wax Melt */
function ConceptCandle({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.candle, isPatron && styles.patron)}>
        <span className={styles.candleFlicker} aria-hidden="true" />
        <div className={styles.candleContent}>
          {isPatron ? <Gem className={styles.candleIcon} /> : <Flame className={styles.candleIcon} />}
          <h4 className={styles.candleTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.candleCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 29. Circuit Board */
function ConceptCircuit({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  const nodes = [[15, 20], [80, 15], [10, 75], [88, 70], [50, 12], [50, 88]];
  return (
    <div className={styles.frame}>
      <div className={cn(styles.circuit, isPatron && styles.patron)}>
        {nodes.map(([x, y], i) => (
          <span
            key={i}
            className={styles.circuitNode}
            style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }}
            aria-hidden="true"
          />
        ))}
        <div className={styles.circuitContent}>
          {isPatron ? <Gem size={26} /> : <Cpu size={26} />}
          <h4 className={styles.circuitTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <span className={styles.circuitCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

/* 30. Embossed Letterpress */
function ConceptEmboss({ mode }: { mode: Mode }) {
  const c = COPY[mode];
  const isPatron = mode === "PATRON_REQUIRED";
  return (
    <div className={styles.frame}>
      <div className={cn(styles.emboss, isPatron && styles.patron)}>
        <div className={styles.embossContent}>
          {isPatron ? <Gem className={styles.embossIcon} /> : <ShieldCheck className={styles.embossIcon} />}
          <h4 className={styles.embossTitle}>
            {c.title} {c.titleAccent}
          </h4>
          <div className={styles.embossRule} />
          <span className={styles.embossCta}>{c.cta}</span>
        </div>
      </div>
    </div>
  );
}

const CONCEPTS: {
  title: string;
  tag: string;
  description: string;
  Component: React.FC<{ mode: Mode }>;
}[] = [
  {
    title: "Aurora Premium (obecny, produkcyjny)",
    tag: "Baseline",
    description:
      "To jest realny komponent AccessLockOverlay używany dziś na produkcji — punkt odniesienia dla reszty propozycji poniżej.",
    Component: ConceptAuroraPremium,
  },
  {
    title: "Frosted Glass Editorial",
    tag: "Szkło / blur",
    description:
      "Półprzezroczysty panel z backdrop-filter blur na gradientowym tle — lekki, nowoczesny, dobrze pasuje do jasnej estetyki premium.",
    Component: ConceptGlass,
  },
  {
    title: "Neubrutalism Block",
    tag: "Grube kontury",
    description:
      "Płaskie kolory, grube 3px obramowania i twarde cienie bez rozmycia — odważny, deklaratywny styl z dużą czytelnością CTA.",
    Component: ConceptBrutalism,
  },
  {
    title: "Cinematic Letterbox",
    tag: "Kino",
    description:
      "Czarne pasy filmowe, subtelny ziarnisty grain i cienka typografia — buduje nastrój 'ekskluzywnego seansu'.",
    Component: ConceptCinematic,
  },
  {
    title: "Editorial Paywall",
    tag: "Prasa / magazyn",
    description:
      "Jasny, drukowany układ inspirowany paywallem NYT — serif nagłówek, cienkie linie, minimalistyczne CTA jako link.",
    Component: ConceptEditorial,
  },
  {
    title: "Ticket Stub",
    tag: "Bilet wstępu",
    description:
      "Karta w kształcie biletu z perforacją i kodem kreskowym — grywalizuje odblokowanie jak wejściówkę na wydarzenie.",
    Component: ConceptTicket,
  },
  {
    title: "HUD Scanner",
    tag: "Interfejs / skan",
    description:
      "Siatka technika, narożniki celownika i pulsujący skan — futurystyczny, 'systemowy' komunikat o ograniczonym dostępie.",
    Component: ConceptHud,
  },
  {
    title: "Liquid Blob Morph",
    tag: "Organiczny ruch",
    description:
      "Płynnie zmieniający kształt gradientowy blob w tle — miękki, żywy, przyciąga wzrok bez agresji (zatrzymuje się przy reduced motion).",
    Component: ConceptLiquid,
  },
  {
    title: "Blueprint Technical",
    tag: "Rysunek techniczny",
    description:
      "Siatka kreślarska, przerywany okrąg celownika i monospace — sugeruje precyzję i 'inżynieryjną' rzetelność produktu.",
    Component: ConceptBlueprint,
  },
  {
    title: "Marquee Ticker",
    tag: "Ruchomy tekst",
    description:
      "W tle przewija się powtarzalny napis (np. 'PATRON • PATRON'), na pierwszym planie zwarty, energiczny komunikat i pigułka CTA.",
    Component: ConceptMarquee,
  },
  {
    title: "Wax Seal / Envelope",
    tag: "Pieczęć / list",
    description:
      "Kremowa koperta z woskową pieczęcią u góry — nawiązuje do 'zaproszenia' i personalnego charakteru odblokowania.",
    Component: ConceptWax,
  },
  {
    title: "Holographic Foil",
    tag: "Holo / karta kolekcjonerska",
    description:
      "Przelewający się tęczowy gradient jak folia na karcie kolekcjonerskiej — efektowny, 'rzadki przedmiot' w odbiorze.",
    Component: ConceptHolo,
  },
  {
    title: "Origami Paper Fold",
    tag: "Papier / geometria",
    description:
      "Geometryczne, złożone płaszczyzny papieru w tle (clip-path) z kartą treści na wierzchu — czyste i nowoczesne.",
    Component: ConceptOrigami,
  },
  {
    title: "Retro Terminal",
    tag: "Konsola / CRT",
    description:
      "Zielony fosfor na czarnym tle, linie skanowania i migający kursor — żartobliwe 'techniczne' podejście do komunikatu dostępu.",
    Component: ConceptTerminal,
  },
  {
    title: "Constellation",
    tag: "Gwiazdozbiór",
    description:
      "Migoczące punkty gwiazd na granatowym tle sugerują coś wyjątkowego i odległego — subtelny, spokojny nastrój premium.",
    Component: ConceptConstellation,
  },
  {
    title: "Hand-drawn Sketch",
    tag: "Szkic / odręczny",
    description:
      "Nieregularna, 'odręczna' ramka i miękkie kształty — przyjazny, mniej korporacyjny ton komunikatu.",
    Component: ConceptSketch,
  },
  {
    title: "Vaporwave Grid",
    tag: "Retro / synthwave",
    description:
      "Zachodzące słońce nad perspektywiczną siatką w stylu lat 80. — odważny, nostalgiczny akcent kolorystyczny.",
    Component: ConceptVaporwave,
  },
  {
    title: "Newspaper Classified",
    tag: "Ogłoszenie prasowe",
    description:
      "Wąska ramka jak ogłoszenie drobne w gazecie, z przekrzywioną pieczątką — lekko humorystyczny, 'urzędowy' klimat.",
    Component: ConceptClassified,
  },
  {
    title: "Membership Card",
    tag: "Karta członkowska",
    description:
      "Plastikowa karta z chipem i połyskiem — traktuje dostęp jak fizyczną kartę członkowską klubu.",
    Component: ConceptCard3D,
  },
  {
    title: "Popup Book Layers",
    tag: "Warstwy 3D",
    description:
      "Ułożone warstwowo kolorowe płaszczyzny budują wrażenie głębi jak w książce pop-up — playful i przestrzenne.",
    Component: ConceptPopup,
  },
  {
    title: "Radial Sunburst",
    tag: "Odznaka / medal",
    description:
      "Promienisty rozbłysk za świecącą odznaką — komunikat jako 'nagroda' albo wyróżnienie do zdobycia.",
    Component: ConceptSunburst,
  },
  {
    title: "Morse Signal",
    tag: "Sygnał / transmisja",
    description:
      "Pulsujący punkt i dekoracyjny wzór kropka-kreska sugerują nadchodzącą, oczekiwaną transmisję/wiadomość.",
    Component: ConceptMorse,
  },
  {
    title: "Watercolor Wash",
    tag: "Akwarela",
    description:
      "Miękkie, rozlane plamy akwareli w tle na jasnej karcie — artystyczny, spokojny, 'ręcznie malowany' charakter.",
    Component: ConceptWatercolor,
  },
  {
    title: "Wireframe Cube",
    tag: "3D / tech",
    description:
      "Obracająca się szkieletowa kostka 3D za treścią — nowoczesny, inżynierski akcent bez zbędnego przepychu.",
    Component: ConceptWireframe,
  },
  {
    title: "Torn Paper Edge",
    tag: "Naderwany papier",
    description:
      "Karta z postrzępioną, 'naderwaną' krawędzią (clip-path) — surowa, fakturowa alternatywa dla gładkich kart.",
    Component: ConceptTorn,
  },
  {
    title: "Neon Sign",
    tag: "Neon",
    description:
      "Świecący napis neonowy na ceglastym tle z migotaniem — nocny, klubowy klimat 'ekskluzywnego wejścia'.",
    Component: ConceptNeon,
  },
  {
    title: "Stained Glass Mosaic",
    tag: "Witraż",
    description:
      "Kolorowe geometryczne segmenty jak witraż w oknie kościoła — dostojny, 'uroczysty' odbiór odblokowania.",
    Component: ConceptMosaic,
  },
  {
    title: "Candlelit Wax Melt",
    tag: "Świeca / ciepło",
    description:
      "Ciepła, migocząca poświata jak przy świecy — przytulny, intymny nastrój zamiast zimnej blokady.",
    Component: ConceptCandle,
  },
  {
    title: "Circuit Board",
    tag: "Płytka PCB",
    description:
      "Ścieżki obwodu drukowanego i pulsujące węzły — 'cyfrowy klucz dostępu' w czysto technicznej estetyce.",
    Component: ConceptCircuit,
  },
  {
    title: "Embossed Letterpress",
    tag: "Wytłoczenie",
    description:
      "Głęboko wytłoczona ikona i napis na papierze — elegancki, minimalistyczny efekt druku typograficznego.",
    Component: ConceptEmboss,
  },
];

export default function NakladkiGallery() {
  const [globalMode, setGlobalMode] = useState<Mode>("LOGIN_REQUIRED");
  const [overrides, setOverrides] = useState<Record<number, Mode>>({});

  const modeFor = (index: number) => overrides[index] ?? globalMode;
  const setModeFor = (index: number, mode: Mode) =>
    setOverrides((current) => ({ ...current, [index]: mode }));

  return (
    <main className="min-h-screen bg-[var(--chan-nav)] px-4 py-10 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1320px]">
        <header className="mb-8 flex flex-col gap-4 rounded-[24px] border border-[color-mix(in_srgb,var(--chan-line)_80%,transparent)] bg-[color-mix(in_srgb,var(--chan-card)_92%,white)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_-24px_rgba(23,23,23,0.2)] md:p-8">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--chan-blue)]">
              Galeria koncepcji · wyłącznie podgląd
            </span>
            <h1 className="mt-2 font-brand text-2xl font-bold text-[var(--chan-ink)] md:text-3xl">
              10 propozycji nakładek dla niezalogowanych i nie-patronów
            </h1>
            <p className="mt-2 max-w-[70ch] text-sm text-[var(--chan-muted)]">
              Strona wyłącznie do przeglądu projektowego — nie wpływa na produkcyjny{" "}
              <code className="rounded bg-[var(--chan-surface)] px-1.5 py-0.5 text-[13px]">
                AccessLockOverlay
              </code>
              . Przełącz globalny stan albo pojedynczą kartę, żeby zobaczyć wariant logowania i wariant
              patrona.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--chan-muted)]">
              Ustaw wszystkie:
            </span>
            <ModeToggle mode={globalMode} onChange={(m) => { setGlobalMode(m); setOverrides({}); }} />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {CONCEPTS.map(({ title, tag, description, Component }, i) => {
            const index = i + 1;
            const mode = modeFor(index);
            return (
              <ConceptCard key={title} index={index} title={title} description={description} tag={tag}>
                <div className="flex items-center justify-end">
                  <ModeToggle mode={mode} onChange={(m) => setModeFor(index, m)} />
                </div>
                <Component mode={mode} />
              </ConceptCard>
            );
          })}
        </div>
      </div>
    </main>
  );
}
