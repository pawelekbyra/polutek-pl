"use client";

import { useAuthModal } from "./auth/AuthModalProvider";
import type { PlaybackPlanStatus } from "@/lib/modules/playback";
import { PlayerStateFrame } from "./PlayerStateFrame";
import { useLanguage } from "./LanguageContext";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

const LOGIN_OVERLAY_COLOR = "#2563EB";
const PATRON_OVERLAY_COLOR = "#FACC15";

function LockSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ffffff"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 11 V8 c0 -3 2 -5 5 -5 s5 2 5 5 v3" />
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <circle cx="12" cy="16.5" r="1.3" fill="#ffffff" stroke="none" />
    </svg>
  );
}

function StarSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" stroke="#ffffff"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 L14.8 9 L22 9 L16.2 13.8 L18.5 21 L12 16.8 L5.5 21 L7.8 13.8 L2 9 L9.2 9 Z" />
    </svg>
  );
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const isPatron = state === "PATRON_REQUIRED";
  const isPl = language === "pl";
  const isCompact = variant !== "default";

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const iconSize = isTiny ? 28 : 34;
    const label = isPatron
      ? (isPl ? "Patroni" : "Patrons")
      : (isPl ? "Zaloguj się" : "Sign in");

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[6px] [container-type:inline-size]"
          style={{
            background: isPatron ? PATRON_OVERLAY_COLOR : LOGIN_OVERLAY_COLOR,
          }}
        >
          <span className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            {isPatron ? <StarSvg size={iconSize} /> : <LockSvg size={iconSize} />}
          </span>
          <span className="px-1 text-center font-sans text-[clamp(9px,8cqi,11px)] font-extrabold uppercase leading-tight tracking-[0.05em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  // Default — full player overlay
  return (
    <PlayerStateFrame className="rounded-[18px]">
      <div className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[18px] bg-[var(--chan-card)]/97 [container-type:inline-size]">
        <div className="relative z-10 flex flex-col items-center text-center gap-[clamp(12px,2.5cqi,22px)] px-4 w-full max-w-[380px]">
          {/* Icon */}
          <div className="flex items-center justify-center w-[clamp(56px,11cqi,80px)] h-[clamp(56px,11cqi,80px)] rounded-full bg-[var(--chan-surface)]">
            <span className={isPatron ? "text-[#b45309]" : "text-[#2563eb]"}>
              {isPatron ? <StarSvg size={32} /> : <LockSvg size={32} />}
            </span>
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-[clamp(4px,1cqi,8px)]">
            <h2 className="font-brand text-[clamp(20px,5cqi,32px)] font-bold text-[var(--chan-ink)] leading-tight">
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p className="font-sans text-[clamp(11px,2.2cqi,15px)] text-[var(--chan-muted)] leading-snug">
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
              className="flex h-[clamp(38px,7cqi,48px)] items-center justify-center px-[clamp(20px,5cqi,32px)] rounded-[14px] bg-[var(--chan-ink)] font-brand font-bold text-[clamp(12px,2.4cqi,15px)] text-white active:scale-95 transition-all hover:-translate-y-px"
            >
              <span className="whitespace-nowrap">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="flex h-[clamp(38px,7cqi,48px)] items-center justify-center px-[clamp(20px,5cqi,32px)] rounded-[14px] bg-[#2563EB] font-brand font-bold text-[clamp(12px,2.4cqi,15px)] text-white active:scale-95 transition-all hover:-translate-y-px"
            >
              <span className="whitespace-nowrap">
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