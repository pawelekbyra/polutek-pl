"use client";

import { SignInButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
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

const overlaySize = {
  default: {
    content: "px-6 py-6",
    iconWrap: "mb-8",
    icon: "h-24 w-24",
    headline: "text-[clamp(2rem,10cqi,6rem)]",
    separator: "my-2 w-48",
    cta: "mt-10 gap-2 text-[10px] tracking-[0.5em]",
    ctaLine: "w-24 group-hover/cta:w-48",
    ctaText: "max-w-[92cqi]",
  },
  thumbnail: {
    content: "px-3 py-2",
    iconWrap: "mb-[clamp(0.45rem,2.3cqi,1rem)]",
    icon: "h-[clamp(1.4rem,12cqi,3.5rem)] w-[clamp(1.4rem,12cqi,3.5rem)]",
    headline: "text-[clamp(1rem,10cqi,3rem)]",
    separator: "my-[clamp(0.125rem,1cqi,0.5rem)] w-[clamp(3.5rem,38cqi,8rem)]",
    cta: "mt-[clamp(0.45rem,3cqi,1.25rem)] gap-1 text-[clamp(0.34rem,2.25cqi,0.55rem)] tracking-[0.16em]",
    ctaLine: "w-[clamp(2.5rem,24cqi,4rem)] group-hover/cta:w-[clamp(3.5rem,34cqi,6rem)]",
    ctaText: "max-w-[86cqi]",
  },
  thumbnailCompact: {
    content: "px-2 py-1",
    iconWrap: "mb-[clamp(0.22rem,1.8cqi,0.42rem)]",
    icon: "h-[clamp(0.95rem,12cqi,1.55rem)] w-[clamp(0.95rem,12cqi,1.55rem)]",
    headline: "text-[clamp(0.62rem,8.5cqi,1rem)]",
    separator: "my-[2px] w-[clamp(2rem,30cqi,3.5rem)]",
    cta: "mt-[clamp(0.2rem,2cqi,0.45rem)] gap-0.5 text-[clamp(4.5px,3cqi,5.5px)] tracking-[0.08em]",
    ctaLine: "w-[clamp(1.25rem,18cqi,2rem)] group-hover/cta:w-[clamp(1.75rem,25cqi,2.5rem)]",
    ctaText: "max-w-[82cqi]",
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
            {isPatronState ? (
              <GemOverlayIcon
                className={cn(
                  "shrink-0 fill-none transition-transform duration-700 group-hover/paywall:scale-110",
                  overlayCopy.accent,
                  size.icon,
                )}
              />
            ) : (
              <LockOverlayIcon
                className={cn(
                  "shrink-0 fill-none transition-transform duration-700 group-hover/paywall:scale-110",
                  overlayCopy.accent,
                  size.icon,
                )}
              />
            )}
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

function GemOverlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3h12l4 6-10 13L2 9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3 8 9l4 13 4-13-3-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 9h20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
