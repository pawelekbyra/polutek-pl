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

const heroSize = {
  default: {
    content: "px-6 py-8",
    icon: "h-16 w-16 md:h-24 md:w-24",
    line: "text-[clamp(2rem,10cqi,6rem)]",
  },
  thumbnail: {
    content: "px-3 py-3",
    icon: "h-[clamp(1.75rem,13cqi,3.25rem)] w-[clamp(1.75rem,13cqi,3.25rem)]",
    line: "text-[clamp(1.05rem,10cqi,2.65rem)]",
  },
} as const;

const compactSize = {
  icon: "h-[clamp(1.1rem,18cqi,1.75rem)] w-[clamp(1.1rem,18cqi,1.75rem)]",
  label: "text-[clamp(0.56rem,8.5cqi,0.78rem)]",
} as const;

export function AccessLockOverlay({ state, variant }: AccessLockOverlayProps) {
  const isPatronState = state === "PATRON_REQUIRED";
  const isLoginState = state === "LOGIN_REQUIRED";
  const isCompact = variant === "thumbnailCompact";

  const overlayCopy = isPatronState
    ? {
        lineOne: "STREFA",
        lineTwo: "PATRONÓW",
        compactLabel: "PATRONÓW",
        gradient: "from-amber-950 via-black to-black",
        accent: "text-amber-500",
      }
    : {
        lineOne: "STREFA",
        lineTwo: "ZALOGOWANYCH",
        compactLabel: "LOGIN",
        gradient: "from-blue-950 via-black to-black",
        accent: "text-blue-400",
      };

  const Icon = isPatronState ? Gem : Lock;

  const loginButton = isLoginState ? (
    <SignInButton mode="modal">
      <button
        type="button"
        aria-label="Zaloguj się"
        className="absolute inset-0 z-20 cursor-pointer bg-transparent text-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white/70"
      />
    </SignInButton>
  ) : null;

  if (isCompact) {
    return (
      <PlayerStateFrame fill>
        <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0a0a0a] text-white [container-type:inline-size]">
          <div
            className={cn(
              "absolute inset-0 z-0 bg-gradient-to-br opacity-65 transition-transform duration-700 group-hover/paywall:scale-110",
              overlayCopy.gradient,
            )}
          />

          <div className="relative z-10 flex min-w-0 flex-col items-center justify-center gap-1 px-2 py-1 text-center">
            <Icon
              className={cn(
                "shrink-0 transition-transform duration-700 group-hover/paywall:scale-110",
                overlayCopy.accent,
                compactSize.icon,
              )}
            />
            <span
              className={cn(
                "max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-brand font-black uppercase leading-none tracking-tight",
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
      <div className="group/paywall absolute inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0a0a0a] text-white animate-in fade-in zoom-in-95 duration-700 [container-type:inline-size]">
        <div
          className={cn(
            "absolute inset-0 z-0 bg-gradient-to-br opacity-65 transition-transform duration-700 group-hover/paywall:scale-110",
            overlayCopy.gradient,
          )}
        />

        <div
          className={cn(
            "relative z-10 flex h-full w-full flex-col items-center justify-center overflow-hidden text-center transition-transform duration-500",
            size.content,
          )}
        >
          <Icon
            className={cn(
              "mb-4 shrink-0 transition-transform duration-700 group-hover/paywall:scale-110 md:mb-8",
              overlayCopy.accent,
              size.icon,
            )}
          />

          <div className="flex max-w-full flex-col items-center overflow-hidden">
            <span
              className={cn(
                "font-brand font-black uppercase leading-[0.8] tracking-tighter whitespace-nowrap text-white",
                size.line,
              )}
            >
              {overlayCopy.lineOne}
            </span>
            <span
              className={cn(
                "font-brand font-black uppercase leading-[0.8] tracking-tighter whitespace-nowrap",
                overlayCopy.accent,
                size.line,
              )}
            >
              {overlayCopy.lineTwo}
            </span>
          </div>
        </div>

        {loginButton}
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
