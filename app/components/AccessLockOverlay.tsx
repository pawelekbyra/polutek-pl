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

// Elegant, high-contrast color overlays
const LOGIN_OVERLAY_DARK = "rgba(15, 23, 42, 0.88)";
const LOGIN_OVERLAY_ACCENT = "rgba(37, 99, 235, 1)";
const PATRON_OVERLAY_START = "rgba(37, 99, 235, 0.92)";
const PATRON_OVERLAY_END = "rgba(59, 130, 246, 0.88)";

function LockSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function StarSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
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
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[8px] [container-type:inline-size]"
          style={{
            background: isPatron
              ? `linear-gradient(135deg, ${PATRON_OVERLAY_START}, ${PATRON_OVERLAY_END})`
              : `linear-gradient(135deg, ${LOGIN_OVERLAY_ACCENT}, ${LOGIN_OVERLAY_DARK})`,
          }}
        >
          <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            {isPatron ? <StarSvg size={iconSize} /> : <LockSvg size={iconSize} />}
          </span>
          <span className="px-2 text-center font-sans text-[clamp(9px,8cqi,11px)] font-bold uppercase leading-tight tracking-[0.08em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  // Default — full player overlay
  return (
    <PlayerStateFrame className="rounded-[18px]">
      <div
        className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[18px] [container-type:inline-size]"
        style={{
          background: isPatron
            ? `linear-gradient(135deg, ${PATRON_OVERLAY_START}, ${PATRON_OVERLAY_END})`
            : `linear-gradient(135deg, ${LOGIN_OVERLAY_ACCENT}, ${LOGIN_OVERLAY_DARK})`,
        }}
      >
        {/* Subtle noise/grain texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,.03) 2px, rgba(255,255,255,.03) 4px)",
          pointerEvents: "none"
        }} />

        <div className="relative z-10 flex flex-col items-center text-center gap-[clamp(16px,3cqi,28px)] px-6 w-full max-w-[420px]">
          {/* Icon Circle */}
          <div className="flex items-center justify-center w-[clamp(64px,12cqi,88px)] h-[clamp(64px,12cqi,88px)] rounded-full bg-white/15 border border-white/20 backdrop-blur-sm shadow-2xl">
            <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {isPatron ? <StarSvg size={36} /> : <LockSvg size={36} />}
            </span>
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-[clamp(8px,1.5cqi,14px)]">
            <h2 className="font-brand text-[clamp(24px,6cqi,36px)] font-bold text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p className="font-sans text-[clamp(13px,2.4cqi,16px)] text-white/90 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.3)]">
              {isPatron
                ? (isPl ? "Jednorazowe wsparcie odblokowuje dostęp na zawsze" : "One-time support unlocks access forever")
                : (isPl ? "aby obejrzeć ten materiał" : "to watch this video")}
            </p>
          </div>

          {/* CTA Button */}
          {isPatron ? (
            <a
              href="#donations"
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById("donations")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className="flex h-[clamp(44px,8cqi,52px)] items-center justify-center px-[clamp(24px,6cqi,40px)] rounded-[16px] bg-white/25 hover:bg-white/35 font-brand font-bold text-[clamp(13px,2.6cqi,16px)] text-white backdrop-blur-sm transition-all duration-200 active:scale-95 hover:shadow-lg border border-white/30"
            >
              <span className="whitespace-nowrap drop-shadow-[0_1px_3px_rgba(0,0,0,0.2)]">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="flex h-[clamp(44px,8cqi,52px)] items-center justify-center px-[clamp(24px,6cqi,40px)] rounded-[16px] bg-white hover:bg-white/95 font-brand font-bold text-[clamp(13px,2.6cqi,16px)] text-[#2563EB] transition-all duration-200 active:scale-95 hover:shadow-lg"
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