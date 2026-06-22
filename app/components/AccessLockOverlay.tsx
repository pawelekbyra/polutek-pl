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
  variant: "default" | "thumbnail";
}

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";
  const isThumbnail = variant === "thumbnail";

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
    "transition-transform duration-700 group-hover/paywall:scale-110",
    isThumbnail
      ? "h-[18cqi] w-[18cqi] max-h-14 max-w-14 min-h-8 min-w-8"
      : "h-16 w-16 md:h-24 md:w-24",
    overlayCopy.accent,
  );

  const headlineClassName = cn(
    "font-brand font-black uppercase tracking-tighter leading-[0.8]",
    isThumbnail
      ? "text-[min(17cqi,2.75rem)]"
      : "text-[clamp(2rem,10cqi,6rem)]",
  );

  const ctaClassName = cn(
    "group/cta mt-3 flex flex-col items-center gap-1.5 bg-transparent text-center font-brand text-[8px] font-black uppercase tracking-[0.3em] text-white/30 transition-colors hover:text-primary md:mt-10 md:gap-2 md:text-[10px] md:tracking-[0.5em]",
    isThumbnail &&
      "mt-2 text-[6px] tracking-[0.22em] md:mt-2 md:text-[7px] md:tracking-[0.28em]",
  );

  const ctaLineClassName = cn(
    "h-px w-16 bg-white/10 transition-all duration-500 group-hover/cta:w-32 md:w-24 md:group-hover/cta:w-48",
    isThumbnail && "w-10 group-hover/cta:w-20 md:w-12 md:group-hover/cta:w-24",
  );

  const action = (
    <>
      <span className={ctaLineClassName} />
      <span>{overlayCopy.actionLabel}</span>
    </>
  );

  return (
    <PlayerStateFrame className={isThumbnail ? "rounded-lg" : undefined}>
      <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a] text-white shadow-2xl animate-in fade-in zoom-in-95 duration-700 [container-type:inline-size]">
        <div
          className={cn(
            "absolute inset-0 z-0 bg-gradient-to-br opacity-60 blur-md transition-transform duration-700 group-hover/paywall:scale-110",
            overlayCopy.gradient,
          )}
        />

        <div className="relative z-10 flex w-full flex-col items-center px-4 text-center transition-transform duration-500 md:px-6">
          <div
            className={cn(
              "flex items-center justify-center",
              isThumbnail ? "mb-2" : "mb-4 md:mb-8",
            )}
          >
            {isPatronState ? (
              <Gem className={iconClassName} />
            ) : (
              <Lock className={iconClassName} />
            )}
          </div>

          <div className="flex flex-col items-center">
            <span className={cn(headlineClassName, "text-white")}>
              {overlayCopy.lineOne}
            </span>
            <div
              className={cn(
                "my-1 h-px w-24 bg-white/10 md:my-2 md:w-48",
                isThumbnail && "my-0.5 w-12 md:my-0.5 md:w-16",
              )}
            />
            <span className={cn(headlineClassName, overlayCopy.accent)}>
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
