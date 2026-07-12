"use client";

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

// Deep, near-black base so the accent color reads as a glow, not a flat wash.
const BASE_BG = "#0a0b10";

function LockSvg({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2.5" />
      <path d="M7 11V8a5 5 0 0 1 10 0v3" />
      <circle cx="12" cy="16" r="1.1" fill="currentColor" stroke="none" />
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

  const glowBackground = isPatron
    ? "radial-gradient(120% 90% at 50% 0%, rgba(234,179,8,0.40) 0%, rgba(10,11,16,0) 62%)"
    : "radial-gradient(120% 90% at 50% 0%, rgba(37,99,235,0.38) 0%, rgba(10,11,16,0) 62%)";

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const iconSize = isTiny ? 22 : 26;
    const label = isPatron
      ? (isPl ? "Patroni" : "Patrons")
      : (isPl ? "Zaloguj się" : "Sign in");

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[7px] overflow-hidden [container-type:inline-size]"
          style={{ background: BASE_BG }}
        >
          <div className="absolute inset-0" style={{ background: glowBackground }} />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" />

          <div
            className={cn(
              "relative flex items-center justify-center rounded-full border backdrop-blur-sm",
              isTiny ? "h-8 w-8" : "h-10 w-10",
              isPatron
                ? "border-yellow-400/50 bg-yellow-400/15"
                : "border-blue-400/50 bg-blue-500/15",
            )}
          >
            <span className={isPatron ? "text-yellow-300" : "text-blue-300"}>
              {isPatron ? <StarSvg size={iconSize} /> : <LockSvg size={iconSize} />}
            </span>
          </div>
          <span className="relative px-2 text-center font-sans text-[clamp(9px,8cqi,11px)] font-bold uppercase leading-tight tracking-[0.08em] text-white">
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
        style={{ background: BASE_BG }}
      >
        {/* Accent glow from the top */}
        <div className="absolute inset-0" style={{ background: glowBackground }} />
        {/* Bottom vignette for text legibility */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

        <div className="relative z-10 flex flex-col items-center text-center gap-[clamp(16px,3cqi,26px)] px-6 w-full max-w-[420px]">
          {/* Icon badge with soft glow */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute inset-0 rounded-full blur-xl"
              style={{
                background: isPatron ? "rgba(234,179,8,0.45)" : "rgba(37,99,235,0.45)",
              }}
            />
            <div
              className={cn(
                "relative flex items-center justify-center w-[clamp(60px,11cqi,80px)] h-[clamp(60px,11cqi,80px)] rounded-full border backdrop-blur-sm",
                isPatron
                  ? "border-yellow-400/50 bg-yellow-400/15"
                  : "border-blue-400/50 bg-blue-500/15",
              )}
            >
              <span className={isPatron ? "text-yellow-300" : "text-blue-300"}>
                {isPatron ? <StarSvg size={34} /> : <LockSvg size={34} />}
              </span>
            </div>
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-[clamp(6px,1.2cqi,10px)]">
            <h2 className="font-brand text-[clamp(22px,5.5cqi,34px)] font-bold text-white leading-tight">
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p className="font-sans text-[clamp(12px,2.2cqi,15px)] text-white/60 leading-relaxed">
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
              className="flex h-[clamp(42px,8cqi,50px)] items-center justify-center px-[clamp(24px,6cqi,38px)] rounded-[14px] bg-gradient-to-b from-yellow-300 to-yellow-500 font-brand font-bold text-[clamp(13px,2.6cqi,16px)] text-[#241a00] shadow-[0_8px_22px_rgba(234,179,8,0.35)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(234,179,8,0.5)]"
            >
              <span className="whitespace-nowrap">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="flex h-[clamp(42px,8cqi,50px)] items-center justify-center px-[clamp(24px,6cqi,38px)] rounded-[14px] bg-[#2563EB] font-brand font-bold text-[clamp(13px,2.6cqi,16px)] text-white shadow-[0_8px_22px_rgba(37,99,235,0.4)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:shadow-[0_10px_26px_rgba(37,99,235,0.55)] hover:bg-[#3B76F0]"
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
