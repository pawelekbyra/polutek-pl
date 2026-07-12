"use client";

import { useId, type CSSProperties } from "react";
import { useAuthModal } from "./auth/AuthModalProvider";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { useLanguage } from "./LanguageContext";
import { cn } from "@/lib/utils";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

// Confident, on-brand gradients — no black. Blue for sign-in, gold for patrons.
const LOGIN_GRADIENT = "linear-gradient(135deg, #2563EB 0%, #1846C4 100%)";
const PATRON_GRADIENT = "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)";

const THEME = {
  login: {
    deep: "#1E40AF",
    mid: "#3B82F6",
    light: "#93C5FD",
  },
  patron: {
    deep: "#B45309",
    mid: "#F59E0B",
    light: "#FDE68A",
  },
} as const;

type Theme = (typeof THEME)["login"];

function LockSvg({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect
        x="5" y="11" width="14" height="10" rx="2.5"
        className={animated ? "lock-draw" : undefined}
        style={animated ? { strokeDasharray: 44, strokeDashoffset: 44 } : undefined}
      />
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        className={animated ? "lock-draw" : undefined}
        style={animated ? { strokeDasharray: 22, strokeDashoffset: 22, animationDelay: "0.15s" } : undefined}
      />
      <circle
        cx="12" cy="16" r="1.1" fill="currentColor" stroke="none"
        className={animated ? "lock-dot-pop" : undefined}
      />
    </svg>
  );
}

function StarSvg({ size = 24, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      className={animated ? "icon-pop-in" : undefined}
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function SparkleSvg({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0 C12 6.5 14 10.5 18 12 C14 13.5 12 17.5 12 24 C12 17.5 10 13.5 6 12 C10 10.5 12 6.5 12 0 Z" />
    </svg>
  );
}

/** Three slow-drifting, hand-shaped vector blobs — a living aurora behind the card. */
function AuroraBackground({ theme, uid }: { theme: Theme; uid: string }) {
  return (
    <svg
      className="absolute inset-0 h-full w-full motion-reduce:hidden"
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="26" />
        </filter>
      </defs>
      <g style={{ filter: `url(#${uid}-blur)` }}>
        <path
          className="aurora-blob-a"
          fill={theme.mid}
          opacity="0.55"
          d="M213,45 C289,58 341,123 344,201 C347,283 289,345 206,347 C122,349 54,290 48,207 C42,124 96,60 172,46 C186,43 199,43 213,45 Z"
        />
        <path
          className="aurora-blob-b"
          fill={theme.light}
          opacity="0.45"
          d="M120,40 C170,10 230,25 245,80 C260,135 230,180 175,190 C120,200 70,175 60,120 C52,80 80,65 120,40 Z"
        />
        <path
          className="aurora-blob-c"
          fill={theme.deep}
          opacity="0.4"
          d="M260,220 C310,210 360,240 365,290 C370,340 330,375 280,370 C230,365 200,330 205,285 C210,245 225,228 260,220 Z"
        />
      </g>
    </svg>
  );
}

const SPARKLE_POSITIONS = [
  { top: "10%", left: "16%", size: 9, delay: "0s" },
  { top: "20%", left: "84%", size: 7, delay: "0.6s" },
  { top: "70%", left: "9%", size: 8, delay: "1.1s" },
  { top: "80%", left: "88%", size: 10, delay: "0.3s" },
  { top: "6%", left: "52%", size: 6, delay: "1.6s" },
];

function SparkleField({ color }: { color: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {SPARKLE_POSITIONS.map((s) => (
        <span
          key={`${s.top}-${s.left}`}
          className="sparkle-particle absolute"
          style={{ top: s.top, left: s.left, color, animationDelay: s.delay }}
        >
          <SparkleSvg size={s.size} />
        </span>
      ))}
    </div>
  );
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const uid = useId();
  const isPatron = state === "PATRON_REQUIRED";
  const isPl = language === "pl";
  const isCompact = variant !== "default";
  const gradient = isPatron ? PATRON_GRADIENT : LOGIN_GRADIENT;
  const theme = isPatron ? THEME.patron : THEME.login;

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const iconSize = isTiny ? 16 : 18;
    const label = isPatron
      ? (isPl ? "Patroni" : "Patrons")
      : (isPl ? "Zaloguj się" : "Sign in");

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className="card-enter absolute inset-0 z-50 flex flex-col items-center justify-center gap-[7px] overflow-hidden [container-type:inline-size]"
          style={{ background: gradient }}
        >
          <div
            className={cn(
              "badge-float relative flex items-center justify-center rounded-full border border-white/40 bg-white/25",
              isTiny ? "h-7 w-7" : "h-9 w-9",
            )}
          >
            <span className="text-white">
              {isPatron ? <StarSvg size={iconSize} animated /> : <LockSvg size={iconSize} animated />}
            </span>
          </div>
          <span className="relative px-2 text-center font-sans text-[clamp(9px,8cqi,11px)] font-bold uppercase leading-tight tracking-[0.08em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  // Default — full player overlay: content floats directly on the living aurora, no boxed card.
  return (
    <PlayerStateFrame className="rounded-[18px]">
      <div
        className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[18px] [container-type:inline-size]"
        style={{ background: gradient }}
      >
        <AuroraBackground theme={theme} uid={uid} />
        {/* Soft radial dimming behind the text zone — legibility without a hard card edge */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(60% 55% at 50% 50%, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 70%)" }}
        />
        <SparkleField color="rgba(255,255,255,0.9)" />

        <div className="card-enter relative z-10 flex w-full max-w-[380px] flex-col items-center gap-[clamp(14px,2.6cqi,20px)] px-8 text-center">
          {/* Icon — glass badge floating on the aurora */}
          <div
            className="badge-float-glow flex items-center justify-center rounded-full w-[clamp(56px,10.5cqi,72px)] h-[clamp(56px,10.5cqi,72px)] bg-white/18 border border-white/35 backdrop-blur-md text-white"
            style={{ "--breathe-ring": "rgba(255,255,255,0.35)" } as CSSProperties}
          >
            <span className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
              {isPatron ? <StarSvg size={30} animated /> : <LockSvg size={30} animated />}
            </span>
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-[clamp(4px,0.8cqi,8px)]">
            <h2 className="font-brand text-[clamp(21px,5cqi,30px)] font-bold text-white leading-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p className="font-sans text-[clamp(12.5px,2.3cqi,15px)] text-white/90 leading-relaxed drop-shadow-[0_1px_8px_rgba(0,0,0,0.3)]">
              {isPatron
                ? (isPl ? "Jednorazowe wsparcie odblokowuje dostęp na zawsze" : "One-time support unlocks access forever")
                : (isPl ? "aby obejrzeć ten materiał" : "to watch this video")}
            </p>
          </div>

          {/* CTA — a white pill floating on the color, not another slab */}
          {isPatron ? (
            <a
              href="#donations"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("donations")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="relative mt-[4px] flex h-[clamp(44px,8.2cqi,50px)] items-center justify-center overflow-hidden px-[clamp(24px,6cqi,36px)] rounded-full bg-white font-brand font-bold text-[clamp(13.5px,2.5cqi,15.5px)] text-amber-800 shadow-[0_14px_30px_-8px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:shadow-[0_16px_34px_-8px_rgba(0,0,0,0.45)]"
            >
              <span className="cta-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />
              <span className="relative whitespace-nowrap">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="relative mt-[4px] flex h-[clamp(44px,8.2cqi,50px)] items-center justify-center overflow-hidden px-[clamp(24px,6cqi,36px)] rounded-full bg-white font-brand font-bold text-[clamp(13.5px,2.5cqi,15.5px)] text-[#1846C4] shadow-[0_14px_30px_-8px_rgba(0,0,0,0.4)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:shadow-[0_16px_34px_-8px_rgba(0,0,0,0.45)]"
            >
              <span className="cta-shimmer pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/[0.06] to-transparent" />
              <span className="relative whitespace-nowrap">
                {isPl ? "Zaloguj się" : "Sign In"}
              </span>
            </button>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;
