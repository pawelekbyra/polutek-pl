"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import type { PlaybackPlanStatus } from "@/lib/services/playback/playback.dto";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { Frame, INK, BLUE } from "./najs/primitives";
import { useLanguage } from "./LanguageContext";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

function LockSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK}
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11 V8 c0 -3 2 -5 5 -5 s5 2 5 5 v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <circle cx="12" cy="16.5" r="1.3" fill={INK} stroke="none" />
    </svg>
  );
}

function StarSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#b45309"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 L14.8 9 L22 9 L16.2 13.8 L18.5 21 L12 16.8 L5.5 21 L7.8 13.8 L2 9 L9.2 9 Z"
        fill="rgba(251,224,138,0.65)" />
    </svg>
  );
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const isPatron = state === "PATRON_REQUIRED";
  const isPl = language === "pl";
  const isCompact = variant !== "default";

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const iconSize = isTiny ? 18 : 22;
    const label = isPatron
      ? (isPl ? "Patroni" : "Patrons")
      : (isPl ? "Zaloguj się" : "Sign in");

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[3px] [container-type:inline-size]"
          style={{ background: "rgba(248,243,231,0.95)" }}
        >
          <svg className="absolute inset-0 h-full w-full pointer-events-none" aria-hidden="true">
            <path
              d={`M 3 4 Q 3 3 4 3 L ${isTiny ? 99 : 154} 3 Q ${isTiny ? 100 : 155} 3 ${isTiny ? 100 : 155} 4 L ${isTiny ? 100 : 155} ${isTiny ? 85 : 87} Q ${isTiny ? 100 : 155} 88 ${isTiny ? 99 : 154} 88 L 4 88 Q 3 88 3 ${isTiny ? 85 : 87} Z`}
              fill="none" stroke={INK} strokeWidth="0.9" opacity="0.4"
            />
          </svg>
          <span className="relative">{isPatron ? <StarSvg size={iconSize} /> : <LockSvg size={iconSize} />}</span>
          <span
            className="relative text-[clamp(7px,3.2cqi,11px)] font-bold text-[#171717] leading-tight px-1 text-center"
            style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}
          >
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  // Default — full player overlay
  return (
    <PlayerStateFrame className="rounded-xl">
      <div
        className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-xl [container-type:inline-size]"
        style={{ background: "rgba(248,243,231,0.97)" }}
      >
        {/* Subtle grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(rgba(23,23,23,.052) 1px, transparent 1px), linear-gradient(90deg, rgba(23,23,23,.052) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative z-10 flex flex-col items-center text-center gap-[clamp(12px,2.5cqi,22px)] px-4 w-full max-w-[380px]">
          {/* Icon in a najs frame */}
          <div className="relative flex items-center justify-center w-[clamp(56px,11cqi,80px)] h-[clamp(56px,11cqi,80px)]">
            <Frame radius={18} seed={9} stroke={INK} strokeWidth={1.2} fill="rgba(248,243,231,0.5)" />
            <span className="relative">
              {isPatron ? <StarSvg size={32} /> : <LockSvg size={32} />}
            </span>
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-[clamp(4px,1cqi,8px)]">
            <h2
              className="text-[clamp(20px,5cqi,38px)] font-bold text-[#171717] leading-tight"
              style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}
            >
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p
              className="text-[clamp(11px,2.2cqi,16px)] text-[#555] leading-snug"
              style={{ fontFamily: "var(--font-patrick, 'Patrick Hand', cursive)" }}
            >
              {isPatron
                ? (isPl ? "Jednorazowe wsparcie odblokowuje dostęp na zawsze" : "One-time support unlocks access forever")
                : (isPl ? "aby obejrzeć ten materiał" : "to watch this video")}
            </p>
          </div>

          {/* CTA */}
          {isPatron ? (
            <a
              href="#donations"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("donations")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="relative flex h-[clamp(38px,7cqi,48px)] items-center justify-center px-[clamp(20px,5cqi,32px)] font-bold text-[clamp(12px,2.4cqi,15px)] text-white active:scale-95 transition-all"
              style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
            >
              <Frame radius={24} seed={5} stroke={INK} strokeWidth={1.4} fill="#171717" showShadow />
              <span className="relative z-10 whitespace-nowrap">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                className="relative flex h-[clamp(38px,7cqi,48px)] items-center justify-center px-[clamp(20px,5cqi,32px)] font-bold text-[clamp(12px,2.4cqi,15px)] text-white active:scale-95 transition-all"
                style={{ fontFamily: "var(--font-najs, Kalam, cursive)" }}
              >
                <Frame radius={24} seed={5} stroke={INK} strokeWidth={1.4} fill={BLUE} showShadow />
                <span className="relative z-10 whitespace-nowrap">
                  {isPl ? "Zaloguj się" : "Sign In"}
                </span>
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;
