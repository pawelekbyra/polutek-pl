"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import type { PlaybackPlanStatus } from "@/lib/services/playback/playback.dto";
import { Gem, Lock } from "./icons";
import { PlayerStateFrame } from "./PlayerStateFrame";

type AccessLockState = Extract<
  PlaybackPlanStatus,
  "LOGIN_REQUIRED" | "PATRON_REQUIRED"
>;

interface AccessLockOverlayProps {
  state: AccessLockState;
  variant: "default" | "thumbnail" | "thumbnailCompact";
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";

  const isDefault = variant === "default";
  const isThumbnail = variant === "thumbnail";
  const isCompact = variant === "thumbnailCompact";
  const isAnyThumbnail = isThumbnail || isCompact;

  const overlayCopy = isPatronState
    ? {
        lineOne: "Strefa",
        lineTwo: "Patronów",
        actionLabel: "Wesprzyj, aby obczaić",
        gradient: "from-amber-900 via-black to-amber-950",
        accent: "text-amber-500",
      }
    : {
        lineOne: "Strefa",
        lineTwo: "Zalogowanych",
        actionLabel: "Zaloguj się, aby obczaić",
        gradient: "from-blue-900 via-black to-blue-950",
        accent: "text-blue-400",
      };

  const iconContainerClassName = cn(
    "flex items-center justify-center rounded-full border border-white/10 bg-white/5 shrink-0",
    isDefault && "h-16 w-16 md:h-24 md:w-24 mb-4 md:mb-6",
    isThumbnail && "h-[clamp(1.9rem,14cqi,3.15rem)] w-[clamp(1.9rem,14cqi,3.15rem)] mb-2",
    isCompact && "h-7 w-7 mb-1"
  );

  const iconClassName = cn(
    "transition-transform duration-700 group-hover/paywall:scale-110",
    overlayCopy.accent,
    isDefault && "h-8 w-8 md:h-12 md:w-12",
    isThumbnail && "h-[clamp(1rem,7.5cqi,1.7rem)] w-[clamp(1rem,7.5cqi,1.7rem)]",
    isCompact && "h-3.5 w-3.5"
  );

  const lineOneClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8] text-white",
    isDefault && "text-[clamp(1.5rem,8cqi,4rem)]",
    isThumbnail && "text-[clamp(0.68rem,5.8cqi,1.15rem)]",
    isCompact && "text-[10px]"
  );

  const lineTwoClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8]",
    overlayCopy.accent,
    isDefault && "text-[clamp(2rem,10cqi,6rem)]",
    isThumbnail && "text-[clamp(0.82rem,7.1cqi,1.45rem)]",
    isCompact && "text-[12px]"
  );

  const separatorClassName = cn(
    "bg-white/10",
    isDefault && "my-1 h-px w-24 md:my-2 md:w-48",
    isThumbnail && "my-0.5 h-px w-12 md:my-0.5 md:w-16",
    isCompact && "my-0.5 h-px w-8"
  );

  const ctaClassName = cn(
    "group/cta flex flex-col items-center gap-1 bg-transparent text-center font-brand font-black uppercase transition-colors hover:text-primary",
    isDefault && "mt-4 text-[8px] tracking-[0.3em] text-white/30 md:mt-6 md:text-[10px] md:tracking-[0.5em]",
    isThumbnail && "mt-2 text-[clamp(0.34rem,2.45cqi,0.56rem)] tracking-[0.18em] text-white/30",
    isCompact && "mt-1 text-[6px] tracking-[0.15em] text-white/30"
  );

  const ctaLineClassName = cn(
    "h-px bg-white/10 transition-all duration-500 group-hover/cta:w-32",
    isDefault && "w-16 md:w-24 md:group-hover/cta:w-48",
    isThumbnail && "w-10 group-hover/cta:w-16 md:w-12 md:group-hover/cta:w-20",
    isCompact && "w-6 group-hover/cta:w-10"
  );

  const action = (
    <>
      <span className={ctaLineClassName} />
      <span>{overlayCopy.actionLabel}</span>
    </>
  );

  return (
    <PlayerStateFrame className={isAnyThumbnail ? "rounded-lg" : undefined}>
      <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a] text-white shadow-2xl animate-in fade-in zoom-in-95 duration-700 [container-type:inline-size]">
        <div
          className={cn(
            "absolute inset-0 z-0 bg-gradient-to-br opacity-60 blur-2xl transition-transform duration-700 group-hover/paywall:scale-110",
            overlayCopy.gradient,
          )}
        />

        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-4 text-center transition-transform duration-500 md:px-6">
          <div className={iconContainerClassName}>
            {isPatronState ? (
              <Gem className={iconClassName} />
            ) : (
              <Lock className={iconClassName} />
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className={lineOneClassName}>{overlayCopy.lineOne}</span>
            <div className={separatorClassName} />
            <span className={lineTwoClassName}>{overlayCopy.lineTwo}</span>

            {isLoginState && (
              <SignInButton mode="modal">
                <button type="button" className={ctaClassName}>
                  {action}
                </button>
              </SignInButton>
            )}

            {isPatronState && (
              <a href="#donations" className={ctaClassName}>
                {action}
              </a>
            )}
          </div>
        </div>
      </div>
    </PlayerStateFrame>
  );
}

export default AccessLockOverlay;
