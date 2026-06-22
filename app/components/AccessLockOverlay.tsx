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
  const isThumbnail = variant === "thumbnail";
  const isCompact = variant === "thumbnailCompact";

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
    "flex items-center justify-center rounded-full border border-white/10 bg-white/5",
    isThumbnail && "h-[clamp(1.9rem,14cqi,3.15rem)] w-[clamp(1.9rem,14cqi,3.15rem)] mb-2",
    isCompact && "h-8 w-8 mb-1.5",
    variant === "default" && "h-16 w-16 md:h-24 md:w-24 mb-6 md:mb-10",
  );

  const iconClassName = cn(
    "transition-transform duration-700 group-hover/paywall:scale-110",
    isThumbnail && "h-[clamp(1rem,7.5cqi,1.7rem)] w-[clamp(1rem,7.5cqi,1.7rem)]",
    isCompact && "h-4 w-4",
    variant === "default" && "h-8 w-8 md:h-12 md:w-12",
    overlayCopy.accent,
  );

  const lineOneClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8] text-white",
    isThumbnail && "text-[clamp(0.68rem,5.8cqi,1.15rem)]",
    isCompact && "text-[0.62rem]",
    variant === "default" && "text-[clamp(1.5rem,8cqi,4rem)]",
  );

  const lineTwoClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8]",
    overlayCopy.accent,
    isThumbnail && "text-[clamp(0.82rem,7.1cqi,1.45rem)]",
    isCompact && "text-[0.82rem]",
    variant === "default" && "text-[clamp(2rem,10cqi,6rem)]",
  );

  const ctaClassName = cn(
    "group/cta flex flex-col items-center gap-1.5 bg-transparent text-center font-brand font-black uppercase transition-colors hover:text-primary",
    isThumbnail && "mt-2 text-[clamp(0.34rem,2.45cqi,0.56rem)] tracking-[0.18em] text-white/30",
    isCompact && "mt-1 text-[0.32rem] tracking-[0.16em] text-white/30",
    variant === "default" && "mt-6 text-[8px] tracking-[0.3em] text-white/30 md:mt-8 md:text-[10px] md:tracking-[0.5em]",
  );

  const ctaLineClassName = cn(
    "h-px w-16 bg-white/10 transition-all duration-500 group-hover/cta:w-32 md:w-24 md:group-hover/cta:w-48",
    isThumbnail && "w-10 group-hover/cta:w-16 md:w-12 md:group-hover/cta:w-20",
    isCompact && "w-8 group-hover/cta:w-12 md:w-8 md:group-hover/cta:w-12",
  );

  const action = (
    <>
      <span className={ctaLineClassName} />
      <span>{overlayCopy.actionLabel}</span>
    </>
  );

  return (
    <PlayerStateFrame className={(isThumbnail || isCompact) ? "rounded-lg" : undefined}>
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

          <div className={cn("flex flex-col items-center", isCompact && "gap-y-0")}>
            <span className={lineOneClassName}>{overlayCopy.lineOne}</span>
            <div
              className={cn(
                "my-1 h-px w-24 bg-white/10 md:my-2 md:w-48",
                isThumbnail && "my-0.5 w-12 md:my-0.5 md:w-16",
                isCompact && "my-0.5 w-8 md:w-8",
              )}
            />
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
