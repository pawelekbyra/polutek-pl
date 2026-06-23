"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { useLanguage } from "./LanguageContext";
import type { PlaybackPlanStatus } from "@/lib/services/playback/playback.dto";
import { PlayerStateFrame } from "./PlayerStateFrame";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

const heroSize = {
  default: {
    content: "px-6 py-7 md:px-10 md:py-10",
    icon: "h-10 w-10 md:h-14 md:w-14",
    kicker: "text-[clamp(0.62rem,1.8cqi,0.86rem)]",
    line: "text-[clamp(2rem,8.5cqi,5.35rem)]",
    note: "text-[clamp(0.68rem,2.2cqi,0.92rem)]",
  },
  thumbnail: {
    content: "px-3 py-3",
    icon: "h-[clamp(1.15rem,8cqi,2rem)] w-[clamp(1.15rem,8cqi,2rem)]",
    kicker: "text-[clamp(0.48rem,4.4cqi,0.66rem)]",
    line: "text-[clamp(1.05rem,9cqi,2.3rem)]",
    note: "text-[clamp(0.5rem,4.2cqi,0.72rem)]",
  },
} as const;

const compactSize = {
  icon: "h-[clamp(0.9rem,14cqi,1.35rem)] w-[clamp(0.9rem,14cqi,1.35rem)]",
  label: "text-[clamp(0.5rem,7.2cqi,0.72rem)]",
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const { language } = useLanguage();
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";
  const isCompact = variant === "thumbnailCompact";
  const isPl = language === "pl";

  const overlayCopy = isPatronState
    ? {
        kicker: isPl ? "dla wspierających" : "for supporters",
        lineOne: isPl ? "DZIĘKUJĘ" : "THANK",
        lineTwo: isPl ? "" : "YOU",
        compactLabel: isPl ? "DZIĘKUJĘ" : "THANK YOU",
        note: isPl
          ? "Ten odcinek odblokowuje jednorazowe wsparcie."
          : "This episode unlocks after a one-time support gift.",
        gradient: "from-[#2b1704] via-[#0b0a08] to-black",
        glow: "bg-amber-400/20",
        accent: "text-amber-300",
        border: "border-amber-300/25",
      }
    : {
        kicker: isPl ? "bezpieczne odtwarzanie" : "secure playback",
        lineOne: isPl ? "ZALOGUJ" : "SIGN",
        lineTwo: isPl ? "SIĘ" : "IN",
        compactLabel: isPl ? "LOGIN" : "SIGN IN",
        note: isPl
          ? "Zaloguj się, żeby obejrzeć ten materiał."
          : "Sign in to watch this video.",
        gradient: "from-[#071b35] via-[#080b12] to-black",
        glow: "bg-sky-400/20",
        accent: "text-sky-300",
        border: "border-sky-300/25",
      };

  const Icon = isPatronState ? HeartSparkIcon : LockOverlayIcon;

  const loginButton = isLoginState ? (
    <SignInButton mode="modal">
      <button
        type="button"
        aria-label={isPl ? "Zaloguj się" : "Sign in"}
        className="absolute inset-0 z-20 cursor-pointer bg-transparent text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white/70"
      />
    </SignInButton>
  ) : null;

  if (isCompact) {
    return (
      <PlayerStateFrame fill>
        <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#090909] text-white [container-type:inline-size]">
          <AccessLockBackdrop gradient={overlayCopy.gradient} glow={overlayCopy.glow} />

          <div className="relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2 py-1 text-center shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <Icon className={cn("shrink-0", overlayCopy.accent, compactSize.icon)} />
            <span
              className={cn(
                "max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-brand font-black uppercase leading-none tracking-[0.12em]",
                overlayCopy.accent,
                compactSize.label,
              )}
            >
              {overlayCopy.compactLabel}
            </span>
          </div>

          {loginButton}
        </div>
      </PlayerStateFrame>
    );
  }

  const size = heroSize[variant];

  return (
    <PlayerStateFrame className={variant === "thumbnail" ? "rounded-lg" : undefined}>
      <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#090909] text-white animate-in fade-in zoom-in-95 duration-700 [container-type:inline-size]">
        <AccessLockBackdrop gradient={overlayCopy.gradient} glow={overlayCopy.glow} />

        <div
          className={cn(
            "relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden text-center transition-transform duration-500",
            size.content,
          )}
        >
          <div className={cn("mb-2 inline-flex items-center gap-2 rounded-full border bg-white/[0.06] px-3 py-1 shadow-[0_12px_35px_rgba(0,0,0,0.28)] backdrop-blur-md md:mb-4", overlayCopy.border)}>
            <Icon className={cn("shrink-0", overlayCopy.accent, size.icon)} />
            <span className={cn("font-black uppercase leading-none tracking-[0.22em] text-white/75", size.kicker)}>
              {overlayCopy.kicker}
            </span>
          </div>

          <div className="flex max-w-full flex-col items-center overflow-hidden">
            <span className={cn("font-brand font-black uppercase leading-[0.82] tracking-tighter whitespace-nowrap text-white", size.line)}>
              {overlayCopy.lineOne}
            </span>
            {overlayCopy.lineTwo && (
              <span className={cn("font-brand font-black uppercase leading-[0.82] tracking-tighter whitespace-nowrap", overlayCopy.accent, size.line)}>
                {overlayCopy.lineTwo}
              </span>
            )}
          </div>

          <p className={cn("mt-2 max-w-[30rem] text-balance font-medium leading-snug text-white/70 md:mt-4", size.note)}>
            {overlayCopy.note}
          </p>
        </div>

        {loginButton}
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;

function AccessLockBackdrop({ gradient, glow }: { gradient: string; glow: string }) {
  return (
    <>
      <div className={cn("absolute inset-0 z-0 bg-gradient-to-br opacity-95 transition-transform duration-700 group-hover/paywall:scale-105", gradient)} />
      <div className={cn("absolute -left-[12%] -top-[28%] z-0 h-[70%] w-[62%] rounded-full blur-3xl transition-transform duration-700 group-hover/paywall:translate-x-4", glow)} />
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.22),transparent_0.42rem),radial-gradient(circle_at_78%_24%,rgba(255,255,255,0.16),transparent_0.32rem),linear-gradient(135deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_18px)] opacity-40" />
      <div className="absolute inset-x-0 bottom-0 z-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
    </>
  );
}

function HeartSparkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 20s-7-4.35-7-10.05A3.95 3.95 0 0 1 12 7.5a3.95 3.95 0 0 1 7 2.45C19 15.65 12 20 12 20Z" fill="currentColor" opacity="0.22" />
      <path d="M12 20s-7-4.35-7-10.05A3.95 3.95 0 0 1 12 7.5a3.95 3.95 0 0 1 7 2.45C19 15.65 12 20 12 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 3.5v3M17 5h3M5.5 4.5v2M4.5 5.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LockOverlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect width="18" height="11" x="3" y="11" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
