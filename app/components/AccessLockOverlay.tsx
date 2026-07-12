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

// Confident, on-brand gradients — no black. Blue for sign-in, gold for patrons.
const LOGIN_GRADIENT = "linear-gradient(135deg, #2563EB 0%, #1846C4 100%)";
const PATRON_GRADIENT = "linear-gradient(135deg, #FBBF24 0%, #D97706 100%)";

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

/** Soft light/dark highlight blobs that give the gradient depth without darkening it toward black. */
function GradientDepth() {
  return (
    <>
      <div
        className="absolute -top-[30%] -left-[15%] h-[70%] w-[70%] rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)" }}
      />
      <div
        className="absolute -bottom-[35%] -right-[20%] h-[60%] w-[60%] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0) 70%)" }}
      />
    </>
  );
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const { open: openAuthModal } = useAuthModal();
  const isPatron = state === "PATRON_REQUIRED";
  const isPl = language === "pl";
  const isCompact = variant !== "default";
  const gradient = isPatron ? PATRON_GRADIENT : LOGIN_GRADIENT;

  if (isCompact) {
    const isTiny = variant === "thumbnailCompact";
    const iconSize = isTiny ? 16 : 18;
    const label = isPatron
      ? (isPl ? "Patroni" : "Patrons")
      : (isPl ? "Zaloguj się" : "Sign in");

    return (
      <PlayerStateFrame fill className={isTiny ? "rounded-md" : "rounded-lg"}>
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-[7px] overflow-hidden [container-type:inline-size]"
          style={{ background: gradient }}
        >
          <GradientDepth />

          <div
            className={cn(
              "relative flex items-center justify-center rounded-full border border-white/40 bg-white/25",
              isTiny ? "h-7 w-7" : "h-9 w-9",
            )}
          >
            <span className="text-white">
              {isPatron ? <StarSvg size={iconSize} /> : <LockSvg size={iconSize} />}
            </span>
          </div>
          <span className="relative px-2 text-center font-sans text-[clamp(9px,8cqi,11px)] font-bold uppercase leading-tight tracking-[0.08em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
            {label}
          </span>
        </div>
      </PlayerStateFrame>
    );
  }

  // Default — full player overlay: colored gradient backdrop + a clean, elevated white card.
  return (
    <PlayerStateFrame className="rounded-[18px]">
      <div
        className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-[18px] [container-type:inline-size]"
        style={{ background: gradient }}
      >
        <GradientDepth />

        <div className="relative z-10 mx-6 flex w-full max-w-[340px] flex-col items-center gap-[clamp(12px,2.2cqi,16px)] rounded-[20px] border border-white/50 bg-white/97 px-[clamp(22px,5cqi,34px)] py-[clamp(24px,5cqi,34px)] text-center shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          {/* Icon */}
          <div
            className={cn(
              "flex items-center justify-center rounded-full w-[clamp(52px,10cqi,68px)] h-[clamp(52px,10cqi,68px)]",
              isPatron ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600",
            )}
          >
            {isPatron ? <StarSvg size={30} /> : <LockSvg size={30} />}
          </div>

          {/* Heading & Description */}
          <div className="flex flex-col gap-[clamp(4px,0.8cqi,7px)]">
            <h2 className="font-brand text-[clamp(19px,4.6cqi,26px)] font-bold text-neutral-900 leading-tight">
              {isPatron
                ? (isPl ? "Strefa Patronów" : "Patron Zone")
                : (isPl ? "Zaloguj się" : "Sign In")}
            </h2>
            <p className="font-sans text-[clamp(12px,2.2cqi,14px)] text-neutral-500 leading-relaxed">
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
              className="mt-[2px] flex h-[clamp(42px,8cqi,48px)] items-center justify-center px-[clamp(22px,5.5cqi,32px)] rounded-[14px] bg-gradient-to-b from-amber-300 to-amber-500 font-brand font-bold text-[clamp(13px,2.4cqi,15px)] text-amber-950 shadow-[0_10px_24px_-6px_rgba(217,119,6,0.45)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:shadow-[0_12px_28px_-6px_rgba(217,119,6,0.55)]"
            >
              <span className="whitespace-nowrap">
                {isPl ? "Wesprzyj kanał" : "Support Channel"}
              </span>
            </a>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal("sign-in")}
              className="mt-[2px] flex h-[clamp(42px,8cqi,48px)] items-center justify-center px-[clamp(22px,5.5cqi,32px)] rounded-[14px] bg-[#2563EB] font-brand font-bold text-[clamp(13px,2.4cqi,15px)] text-white shadow-[0_10px_24px_-6px_rgba(37,99,235,0.5)] transition-all duration-200 active:scale-95 hover:-translate-y-px hover:bg-[#1d4ed8] hover:shadow-[0_12px_28px_-6px_rgba(37,99,235,0.6)]"
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
