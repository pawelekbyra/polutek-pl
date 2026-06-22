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

  const iconClassName = cn(
    "shrink-0 transition-transform duration-700 group-hover/paywall:scale-110",
    overlayCopy.accent,
    isDefault && "mb-4 h-16 w-16 md:mb-8 md:h-24 md:w-24",
    isThumbnail && "mb-2 h-[clamp(1.55rem,13cqi,3.25rem)] w-[clamp(1.55rem,13cqi,3.25rem)]",
    isCompact && "mb-1 h-[clamp(1rem,13cqi,1.45rem)] w-[clamp(1rem,13cqi,1.45rem)]",
  );

  const lineClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8] whitespace-nowrap",
    isDefault && "text-[clamp(2rem,10cqi,6rem)]",
    isThumbnail && "text-[clamp(1.2rem,10.5cqi,2.65rem)]",
    isCompact && "text-[clamp(0.62rem,6.4cqi,0.86rem)]",
  );

  const separatorClassName = cn(
    "h-px bg-white/10",
    isDefault && "my-1 w-24 md:my-2 md:w-48",
    isThumbnail && "my-0.5 w-14 md:w-20",
    isCompact && "my-[2px] w-8",
  );

  const ctaClassName = cn(
    "group/cta flex max-w-full flex-col items-center bg-transparent text-center font-brand font-black uppercase text-white/30 transition-colors hover:text-primary",
    isDefault && "mt-6 gap-2 text-[8px] tracking-[0.3em] md:mt-10 md:text-[10px] md:tracking-[0.5em]",
    isThumbnail && "mt-2 gap-1 text-[clamp(0.34rem,2.35cqi,0.52rem)] tracking-[0.16em]",
    isCompact && "mt-1 gap-0.5 text-[5px] tracking-[0.08em]",
  );

  const ctaLineClassName = cn(
    "h-px bg-white/10 transition-all duration-500",
    isDefault && "w-16 group-hover/cta:w-32 md:w-24 md:group-hover/cta:w-48",
    isThumbnail && "w-10 group-hover/cta:w-16 md:w-12 md:group-hover/cta:w-20",
    isCompact && "w-5 group-hover/cta:w-8",
  );

  const ctaTextClassName = cn(
    "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
    isDefault && "max-w-[92cqi]",
    isThumbnail && "max-w-[86cqi]",
    isCompact && "max-w-[74cqi]",
  );

  const action = (
    <>
      <span className={ctaLineClassName} />
      <span className={ctaTextClassName}>{overlayCopy.actionLabel}</span>
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

        <div
          className={cn(
            "relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden text-center transition-transform duration-500",
            isDefault && "px-6 py-6",
            isThumbnail && "px-3 py-2",
            isCompact && "px-2 py-1",
          )}
        >
          {isPatronState ? (
            <Gem className={iconClassName} />
          ) : (
            <Lock className={iconClassName} />
          )}

          <div className="flex max-w-full flex-col items-center overflow-hidden">
            <span className={cn(lineClassName, "text-white")}>
              {overlayCopy.lineOne}
            </span>
            <div className={separatorClassName} />
            <span className={cn(lineClassName, overlayCopy.accent)}>
              {overlayCopy.lineTwo}
            </span>

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
