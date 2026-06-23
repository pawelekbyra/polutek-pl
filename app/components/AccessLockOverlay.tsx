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

const overlaySize = {
  default: {
    content: "px-6 py-6",
    iconWrap: "mb-4 md:mb-8",
    icon: "h-16 w-16 md:h-24 md:w-24",
    headline: "text-[clamp(2rem,10cqi,6rem)]",
    separator: "my-1 w-24 md:my-2 md:w-48",
    cta: "mt-3 gap-1.5 text-[8px] tracking-[0.3em] md:mt-10 md:gap-2 md:text-[10px] md:tracking-[0.5em]",
    ctaLine: "w-16 group-hover/cta:w-32 md:w-24 md:group-hover/cta:w-48",
    ctaText: "max-w-[92cqi]",
  },
  thumbnail: {
    content: "px-3 py-2",
    iconWrap: "mb-2",
    icon: "h-[clamp(1.55rem,13cqi,3.25rem)] w-[clamp(1.55rem,13cqi,3.25rem)]",
    headline: "text-[clamp(1.05rem,10cqi,2.65rem)]",
    separator: "my-0.5 w-14 md:w-20",
    cta: "mt-2 gap-1 text-[clamp(0.34rem,2.35cqi,0.52rem)] tracking-[0.16em]",
    ctaLine: "w-10 group-hover/cta:w-16 md:w-12 md:group-hover/cta:w-20",
    ctaText: "max-w-[86cqi]",
  },
  thumbnailCompact: {
    content: "px-2 py-1",
    iconWrap: "mb-1",
    icon: "h-[clamp(1rem,13cqi,1.45rem)] w-[clamp(1rem,13cqi,1.45rem)]",
    headline: "text-[clamp(0.62rem,6.4cqi,0.86rem)]",
    separator: "my-[2px] w-8",
    cta: "mt-1 gap-0.5 text-[5px] tracking-[0.08em]",
    ctaLine: "w-5 group-hover/cta:w-8",
    ctaText: "max-w-[74cqi]",
  },
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";
  const isAnyThumbnail = variant === "thumbnail" || variant === "thumbnailCompact";
  const size = overlaySize[variant];

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

  const Icon = isPatronState ? Gem : Lock;

  const ctaClassName = cn(
    "group/cta flex max-w-full flex-col items-center bg-transparent p-0 text-center font-brand font-black uppercase text-white/30 no-underline transition-colors hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70",
    isLoginState && "border-0 cursor-pointer",
    size.cta,
  );

  const action = (
    <>
      <span
        className={cn(
          "h-px bg-white/10 transition-all duration-500",
          size.ctaLine,
        )}
      />
      <span
        className={cn(
          "block max-w-full overflow-hidden text-ellipsis whitespace-nowrap",
          size.ctaText,
        )}
      >
        {overlayCopy.actionLabel}
      </span>
    </>
  );

  return (
    <PlayerStateFrame className={isAnyThumbnail ? "rounded-lg" : undefined}>
      <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden border border-[#1a1a1a] bg-[#0a0a0a] text-white shadow-2xl animate-in fade-in zoom-in-95 duration-700 [container-type:inline-size]">
        <div
          className={cn(
            "absolute inset-0 z-0 bg-gradient-to-br opacity-60 blur-md transition-transform duration-700 group-hover/paywall:scale-110",
            overlayCopy.gradient,
          )}
        />

        <div
          className={cn(
            "relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden text-center transition-transform duration-500",
            size.content,
          )}
        >
          <div className={cn("flex items-center justify-center", size.iconWrap)}>
            <Icon
              className={cn(
                "shrink-0 transition-transform duration-700 group-hover/paywall:scale-110",
                overlayCopy.accent,
                size.icon,
              )}
            />
          </div>

          <div className="flex max-w-full flex-col items-center overflow-hidden">
            <span
              className={cn(
                "font-brand font-black uppercase leading-[0.8] tracking-tighter whitespace-nowrap text-white",
                size.headline,
              )}
            >
              {overlayCopy.lineOne}
            </span>
            <div className={cn("h-px bg-white/10", size.separator)} />
            <span
              className={cn(
                "font-brand font-black uppercase leading-[0.8] tracking-tighter whitespace-nowrap",
                overlayCopy.accent,
                size.headline,
              )}
            >
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
